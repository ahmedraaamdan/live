/**
 * What happens when money arrives (or doesn't), and when a lecture is
 * cancelled. Called by the Paymob webhook, the mock gateway and free
 * bookings alike, and safe to call twice for the same payment.
 */
import { and, eq, inArray } from "drizzle-orm";
import {
  bookingsTable,
  db,
  lecturesTable,
  parentLinksTable,
  paymentsTable,
  studentProfilesTable,
  usersTable,
  type Payment,
} from "@workspace/db";
import type { PaymentMethod } from "@workspace/live-core";
import { sendBookingConfirmed } from "./emails";
import { recordSale, reverseBooking } from "./ledger";
import { logger } from "./logger";
import { notify } from "./notify";
import { provider } from "./payments";

export async function parentsOf(studentId: string) {
  const profile = await db.query.studentProfilesTable.findFirst({ where: eq(studentProfilesTable.userId, studentId) });
  const linked = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(parentLinksTable)
    .innerJoin(usersTable, eq(usersTable.id, parentLinksTable.parentId))
    .where(eq(parentLinksTable.studentId, studentId));
  const emails = new Set(linked.map((p) => p.email));
  if (profile?.parentEmail) emails.add(profile.parentEmail);
  return { ids: linked.map((p) => p.id), emails: [...emails], linkCode: profile?.linkCode ?? "" };
}

/** Emails and notifications once a booking is confirmed (paid or free). */
export async function onBookingConfirmed(bookingId: string) {
  const [row] = await db
    .select({ booking: bookingsTable, lecture: lecturesTable, student: usersTable })
    .from(bookingsTable)
    .innerJoin(lecturesTable, eq(lecturesTable.id, bookingsTable.lectureId))
    .innerJoin(usersTable, eq(usersTable.id, bookingsTable.studentId))
    .where(eq(bookingsTable.id, bookingId));
  if (!row) return;
  const teacher = await db.query.usersTable.findFirst({ where: eq(usersTable.id, row.lecture.teacherId) });
  const parents = await parentsOf(row.student.id);

  await sendBookingConfirmed({
    student: row.student,
    lecture: row.lecture,
    teacherName: teacher?.name ?? "",
    amountCents: row.booking.pricePaidCents,
    parentEmails: parents.emails,
    childCode: parents.linkCode,
  });
  await notify([row.student.id], { kind: "booking", title: "حجزك اتأكد", body: row.lecture.title, link: `/lectures/${row.lecture.id}` });
  await notify(parents.ids, { kind: "booking", title: `${row.student.name} حجز حصة جديدة`, body: row.lecture.title, link: `/p/children/${row.student.id}` });
  await notify([row.lecture.teacherId], { kind: "booking", title: `حجز جديد: ${row.student.name}`, body: row.lecture.title, link: `/lectures/${row.lecture.id}` });
}

export async function confirmPayment(paymentId: string, opts: { txnId?: string; method?: PaymentMethod; raw?: unknown }) {
  const outcome = await db.transaction(async (tx) => {
    const [payment] = await tx.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId)).for("update");
    if (!payment || payment.status === "succeeded" || payment.status === "refunded") return null;
    const [booking] = await tx.select().from(bookingsTable).where(eq(bookingsTable.id, payment.bookingId)).for("update");
    const [lecture] = await tx.select().from(lecturesTable).where(eq(lecturesTable.id, booking!.lectureId));
    const [paid] = await tx
      .update(paymentsTable)
      .set({ status: "succeeded", providerTxnId: opts.txnId ?? payment.providerTxnId, method: opts.method ?? payment.method, raw: opts.raw ?? payment.raw, updatedAt: new Date() })
      .where(eq(paymentsTable.id, payment.id))
      .returning();
    // Paid twice (two tabs, a retry): keep the first, give this one back.
    if (booking!.status === "confirmed") return { duplicate: paid! };
    const [confirmed] = await tx
      .update(bookingsTable)
      .set({ status: "confirmed", confirmedAt: new Date(), pricePaidCents: payment.amountCents })
      .where(eq(bookingsTable.id, booking!.id))
      .returning();
    await recordSale(tx, { lecture: lecture!, booking: confirmed!, payment: paid! });
    return { bookingId: confirmed!.id };
  });

  if (outcome && "duplicate" in outcome) {
    await refundPayment(outcome.duplicate!, "دفع مكرر");
  } else if (outcome) {
    await onBookingConfirmed(outcome.bookingId);
  }
}

export async function failPayment(paymentId: string, raw?: unknown) {
  await db.transaction(async (tx) => {
    const [payment] = await tx.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId)).for("update");
    if (!payment || payment.status !== "pending") return;
    await tx.update(paymentsTable).set({ status: "failed", raw: raw ?? payment.raw, updatedAt: new Date() }).where(eq(paymentsTable.id, paymentId));
    await tx
      .update(bookingsTable)
      .set({ status: "cancelled" })
      .where(and(eq(bookingsTable.id, payment.bookingId), eq(bookingsTable.status, "pending_payment")));
  });
}

async function refundPayment(payment: Payment, reason: string) {
  try {
    await provider.refund(payment);
    await db.update(paymentsTable).set({ status: "refunded", updatedAt: new Date() }).where(eq(paymentsTable.id, payment.id));
  } catch (err) {
    // Stays "succeeded"; the admin overview lists it for a manual refund.
    logger.error({ err, paymentId: payment.id, reason }, "Refund failed, needs a manual refund");
  }
}

/** Teacher cancelled: refund every paid booking and reverse its credits. */
export async function refundLecture(lectureId: string) {
  const bookings = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.lectureId, lectureId), inArray(bookingsTable.status, ["confirmed", "pending_payment"])));
  for (const b of bookings) {
    const payments = await db
      .select()
      .from(paymentsTable)
      .where(and(eq(paymentsTable.bookingId, b.id), eq(paymentsTable.status, "succeeded")));
    for (const p of payments) await refundPayment(p, "lecture cancelled");
    await db.transaction(async (tx) => {
      await reverseBooking(tx, b.id, "إلغاء الحصة");
      await tx.update(bookingsTable).set({ status: payments.length ? "refunded" : "cancelled" }).where(eq(bookingsTable.id, b.id));
      await tx
        .update(paymentsTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(and(eq(paymentsTable.bookingId, b.id), eq(paymentsTable.status, "pending")));
    });
  }
  return bookings.map((b) => b.studentId);
}
