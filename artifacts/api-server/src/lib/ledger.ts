/**
 * The money ledger. Rules:
 *   - a paid booking credits the teacher (price − fee) and the platform
 *     (fee, PLATFORM_FEE_BPS of the price), both "pending";
 *   - PAYOUT_HOLD_HOURS after the lecture ends, they become "available"
 *     (the window for refunds if the lecture didn't happen properly);
 *   - a payout request debits "available" at once, so it can't be spent
 *     twice; a rejected request voids that debit;
 *   - a refund voids pending credits, or reverses released ones.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, payoutsTable, walletEntriesTable, type Booking, type Lecture, type Payment } from "@workspace/db";
import { splitBooking } from "@workspace/live-core";
import { env } from "./env";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function recordSale(tx: Tx, opts: { lecture: Lecture; booking: Booking; payment: Payment }) {
  const { platformCents, teacherCents } = splitBooking(opts.payment.amountCents, env.feeBps);
  const base = { lectureId: opts.lecture.id, bookingId: opts.booking.id, paymentId: opts.payment.id, status: "pending" as const };
  await tx.insert(walletEntriesTable).values([
    { ...base, owner: "teacher", teacherId: opts.lecture.teacherId, kind: "sale", amountCents: teacherCents, memo: opts.lecture.title },
    { ...base, owner: "platform", teacherId: opts.lecture.teacherId, kind: "commission", amountCents: platformCents, memo: opts.lecture.title },
  ]);
}

export async function releaseLectureFunds(lectureId: string, q: Tx | typeof db = db) {
  await q
    .update(walletEntriesTable)
    .set({ status: "available" })
    .where(and(eq(walletEntriesTable.lectureId, lectureId), eq(walletEntriesTable.status, "pending"), inArray(walletEntriesTable.kind, ["sale", "commission"])));
}

/** Undo a booking's credits: void what's still pending, reverse what was released. */
export async function reverseBooking(tx: Tx, bookingId: string, memo: string, paymentId?: string) {
  const entries = await tx
    .select()
    .from(walletEntriesTable)
    .where(and(eq(walletEntriesTable.bookingId, bookingId), inArray(walletEntriesTable.kind, ["sale", "commission"]), paymentId ? eq(walletEntriesTable.paymentId, paymentId) : undefined))
    .orderBy(walletEntriesTable.id).for("update");
  for (const e of entries) {
    if (e.status === "pending") {
      await tx.update(walletEntriesTable).set({ status: "void" }).where(eq(walletEntriesTable.id, e.id));
    } else if (e.status === "available") {
      const previous = await tx.query.walletEntriesTable.findFirst({ where: and(eq(walletEntriesTable.bookingId, bookingId), eq(walletEntriesTable.paymentId, e.paymentId!), eq(walletEntriesTable.owner, e.owner), eq(walletEntriesTable.kind, "refund")) });
      if (previous) continue;
      await tx.insert(walletEntriesTable).values({
        owner: e.owner,
        teacherId: e.teacherId,
        kind: "refund",
        amountCents: -e.amountCents,
        status: "available",
        lectureId: e.lectureId,
        bookingId: e.bookingId,
        paymentId: e.paymentId,
        memo,
      });
    }
  }
}

export interface TeacherBalances {
  availableCents: number;
  pendingCents: number;
  lifetimeCents: number;
  paidOutCents: number;
  requestedCents: number;
}

export async function teacherBalances(teacherId: string, q: Tx | typeof db = db): Promise<TeacherBalances> {
  const [row] = await q
    .select({
      available: sql<number>`coalesce(sum(${walletEntriesTable.amountCents}) filter (where ${walletEntriesTable.status} = 'available'), 0)`,
      pending: sql<number>`coalesce(sum(${walletEntriesTable.amountCents}) filter (where ${walletEntriesTable.status} = 'pending'), 0)`,
      lifetime: sql<number>`coalesce(sum(${walletEntriesTable.amountCents}) filter (where ${walletEntriesTable.kind} in ('sale', 'refund') and ${walletEntriesTable.status} <> 'void'), 0)`,
      payouts: sql<number>`coalesce(-sum(${walletEntriesTable.amountCents}) filter (where ${walletEntriesTable.kind} = 'payout' and ${walletEntriesTable.status} <> 'void'), 0)`,
    })
    .from(walletEntriesTable)
    .where(and(eq(walletEntriesTable.owner, "teacher"), eq(walletEntriesTable.teacherId, teacherId)));
  const [requested] = await q
    .select({ total: sql<number>`coalesce(sum(${payoutsTable.amountCents}), 0)` })
    .from(payoutsTable)
    .where(and(eq(payoutsTable.teacherId, teacherId), eq(payoutsTable.status, "requested")));
  const requestedCents = Number(requested?.total ?? 0);
  const payouts = Number(row?.payouts ?? 0);
  return {
    availableCents: Number(row?.available ?? 0),
    pendingCents: Number(row?.pending ?? 0),
    lifetimeCents: Number(row?.lifetime ?? 0),
    paidOutCents: payouts - requestedCents,
    requestedCents,
  };
}
