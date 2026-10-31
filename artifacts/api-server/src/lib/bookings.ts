/**
 * What happens when money arrives (or doesn't), and when a lecture is
 * cancelled. Called by the Paymob webhook, the mock gateway and free
 * bookings alike, and safe to call twice for the same payment.
 */
import { and, count, eq, gte, inArray, or, sql } from "drizzle-orm";
import {
  bookingsTable,
  db,
  lecturesTable,
  parentLinksTable,
  paymentsTable,
  studentProfilesTable,
  usersTable,
  type Lecture,
  type Payment,
} from "@workspace/db";
import type { PaymentMethod } from "@workspace/live-core";
import { sendBookingConfirmed, sendLectureCancelled, sendLectureRescheduled } from "./emails";
import { recordSale, reverseBooking } from "./ledger";
import { logger } from "./logger";
import { notify, notifyAdmins } from "./notify";
import { paymentProviderFor } from "./payments";

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
  // Follow the booking path's lock order: lecture, payment, booking.
  const candidate = await db.query.paymentsTable.findFirst({ where: eq(paymentsTable.id, paymentId) });
  if (!candidate) return;
  const seat = await db.query.bookingsTable.findFirst({ where: eq(bookingsTable.id, candidate.bookingId) });
  if (!seat) return;
  const outcome = await db.transaction(async (tx) => {
    const [lecture] = await tx.select().from(lecturesTable).where(eq(lecturesTable.id, seat.lectureId)).for("update");
    const [payment] = await tx.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId)).for("update");
    if (!payment || payment.status === "succeeded" || payment.status === "refunded") return null;
    const [booking] = await tx.select().from(bookingsTable).where(eq(bookingsTable.id, payment.bookingId)).for("update");

    const [paid] = await tx
      .update(paymentsTable)
      .set({ status: "succeeded", providerTxnId: opts.txnId ?? payment.providerTxnId, method: opts.method ?? payment.method, raw: opts.raw ?? payment.raw, updatedAt: new Date() })
      .where(eq(paymentsTable.id, payment.id))
      .returning();
    // Paid twice (two tabs, a retry): keep the first, give this one back.
    if (booking!.status === "confirmed") return { duplicate: paid! };
    // A slow payment can land after the class was cancelled or already over: give it back.
    if (lecture!.status === "cancelled" || lecture!.status === "ended") {
      await tx.update(bookingsTable).set({ status: "cancelled" }).where(eq(bookingsTable.id, booking!.id));
      return { duplicate: paid! };
    }
    // A payment may arrive after its seat hold expired and another student booked.
    if (lecture!.capacity) {
      const [others] = await tx.select({ n: count() }).from(bookingsTable).where(and(eq(bookingsTable.lectureId, lecture!.id), sql`${bookingsTable.id} <> ${booking!.id}`, or(eq(bookingsTable.status, "confirmed"), and(eq(bookingsTable.status, "pending_payment"), gte(bookingsTable.createdAt, new Date(Date.now() - 60 * 60_000))))));
      if (Number(others?.n ?? 0) >= lecture!.capacity) {
        await tx.update(bookingsTable).set({ status: "cancelled" }).where(eq(bookingsTable.id, booking!.id));
        return { duplicate: paid! };
      }
    }
    const [confirmed] = await tx
      .update(bookingsTable)
      .set({ status: "confirmed", confirmedAt: new Date(), confirmedPaymentId: payment.id, pricePaidCents: payment.amountCents })
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
    await db.transaction(async tx => {
      const [current] = await tx.select().from(paymentsTable).where(eq(paymentsTable.id, payment.id)).for("update");
      if (!current || current.status !== "succeeded") return;
      await paymentProviderFor(current.provider).refund(current);
      await tx.update(paymentsTable).set({ status: "refunded", updatedAt: new Date() }).where(eq(paymentsTable.id, payment.id));
    });
  } catch (err) {
    // Stays "succeeded"; the admin overview lists it for a manual refund.
    logger.error({ err, paymentId: payment.id, reason }, "Refund failed, needs a manual refund");
    const current = await db.query.paymentsTable.findFirst({ where: eq(paymentsTable.id, payment.id) });
    const previous = (current?.raw ?? {}) as Record<string, unknown>;
    await db.update(paymentsTable).set({ raw: { ...previous, gahezRefundPending: true, gahezRefundReason: reason } }).where(eq(paymentsTable.id, payment.id));
    if (!previous.gahezRefundPending) {
      const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
      await notify(admins.map(a => a.id), { kind: "refund", title: "استرداد يحتاج إلى مراجعة", body: `عملية ${payment.id}`, link: "/admin" });
    }
  }
}

/** Give one booking's money back, undo its credits and free its seat. */
export async function refundBooking(bookingId: string, memo: string, reason: string) {
  const payments = await db
    .select()
    .from(paymentsTable)
    .where(and(eq(paymentsTable.bookingId, bookingId), eq(paymentsTable.status, "succeeded")));
  for (const p of payments) await refundPayment(p, reason);
  await db.transaction(async (tx) => {
    await reverseBooking(tx, bookingId, memo);
    const settled = payments.length ? await tx.select({ id: paymentsTable.id }).from(paymentsTable).where(and(inArray(paymentsTable.id, payments.map(p => p.id)), eq(paymentsTable.status, "refunded"))) : [];
    await tx.update(bookingsTable).set({ status: payments.length && settled.length === payments.length ? "refunded" : "cancelled" }).where(eq(bookingsTable.id, bookingId));
    await tx
      .update(paymentsTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(and(eq(paymentsTable.bookingId, bookingId), eq(paymentsTable.status, "pending")));
  });
}

/** Refund every paid booking of a lecture and reverse its credits. */
export async function refundLecture(lectureId: string, memo = "إلغاء الحصة", reason = "lecture cancelled") {
  const bookings = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.lectureId, lectureId), inArray(bookingsTable.status, ["confirmed", "pending_payment"])));
  for (const b of bookings) await refundBooking(b.id, memo, reason);
  return bookings.map((b) => b.studentId);
}

/** Students and the parents following them, with everyone's email addresses. */
async function audienceOf(studentIds: string[]) {
  const unique = [...new Set(studentIds)];
  const students = unique.length ? await db.select().from(usersTable).where(inArray(usersTable.id, unique)) : [];
  const parents = await Promise.all(unique.map(parentsOf));
  const parentEmails = [...new Set(parents.flatMap((p) => p.emails))];
  return { students, parentIds: parents.flatMap((p) => p.ids), recipients: [...students.map((s) => ({ email: s.email })), ...parentEmails.map((email) => ({ email }))] };
}

/** Everything after a lecture is marked cancelled: money back, and everyone told. */
export async function settleCancelledLecture(lecture: Lecture, opts: { noShow?: boolean } = {}) {
  const studentIds = await refundLecture(lecture.id, opts.noShow ? "لم تبدأ الحصة في موعدها" : "إلغاء الحصة", opts.noShow ? "teacher no-show" : "lecture cancelled");
  const notice = { kind: "cancelled", title: opts.noShow ? "أُلغيت الحصة لأن المدرس لم يبدأها" : "أُلغيت الحصة", body: `${lecture.title}${lecture.priceCents > 0 ? " — يمكنك متابعة حالة عملية الدفع من حسابك" : ""}`, link: `/lectures/${lecture.id}` };
  if (studentIds.length) {
    const { parentIds, recipients } = await audienceOf(studentIds);
    await notify(studentIds, notice);
    await notify(parentIds, notice);
    void sendLectureCancelled(recipients, lecture, opts);
  }
  if (opts.noShow) {
    await notify([lecture.teacherId], { kind: "cancelled", title: "أُلغيت حصتك لأنها لم تبدأ في موعدها", body: lecture.title, link: `/lectures/${lecture.id}` });
    if (studentIds.length) await notifyAdmins({ kind: "cancelled", title: "حصة لم يبدأها المدرس", body: `${lecture.title} · ${new Set(studentIds).size} طالب`, link: "/admin" });
  }
  return studentIds;
}

/** The teacher moved a class that students already booked. */
export async function announceReschedule(lecture: Lecture, previousStart: Date) {
  const rows = await db.select({ id: bookingsTable.studentId }).from(bookingsTable).where(and(eq(bookingsTable.lectureId, lecture.id), eq(bookingsTable.status, "confirmed")));
  if (!rows.length) return;
  const studentIds = rows.map((r) => r.id);
  const { parentIds, recipients } = await audienceOf(studentIds);
  const notice = { kind: "rescheduled", title: "تغيّر موعد حصتك", body: `${lecture.title} — يمكنك إلغاء حجزك إذا لم يناسبك الموعد الجديد`, link: `/lectures/${lecture.id}` };
  await notify(studentIds, notice);
  await notify(parentIds, notice);
  void sendLectureRescheduled(recipients, lecture, previousStart);
}
