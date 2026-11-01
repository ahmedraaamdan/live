import { Router } from "express";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { attendanceTable, bookingsTable, db, lectureReportsTable, lecturesTable, paymentsTable, payoutsTable, usersTable, walletEntriesTable } from "@workspace/db";
import { FUNDS_MIN_ATTENDED_SECONDS, fundsDecisionSchema, payoutDecisionSchema, reportDecisionSchema, type AdminOverviewDTO, type FundReviewDTO, type PaymentMethod } from "@workspace/live-core";
import { recordAdminAction } from "../lib/audit";
import { requireUser, roleGate } from "../lib/auth";
import { toMini, toPayout } from "../lib/dto";
import { sendPayoutUpdate } from "../lib/emails";
import { decideLectureFunds, resolveLectureReport } from "../lib/funds";
import { badRequest, notFound, parse, uuidParam } from "../lib/http";
import { notify } from "../lib/notify";

const router = Router();
router.use("/admin", roleGate("admin"));

router.get("/admin/overview", async (_req, res) => {
  const sumWhere = (where: ReturnType<typeof and>) =>
    db
      .select({ v: sql<number>`coalesce(sum(${walletEntriesTable.amountCents}), 0)` })
      .from(walletEntriesTable)
      .where(where)
      .then((r) => Number(r[0]?.v ?? 0));
  const [gmv, platform, teacherPayable, paidOut, roles, lectures, bookings, recent, pending, reviews] = await Promise.all([
    db
      .select({ v: sql<number>`coalesce(sum(${paymentsTable.amountCents}), 0)` })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "succeeded"))
      .then((r) => Number(r[0]?.v ?? 0)),
    sumWhere(and(eq(walletEntriesTable.owner, "platform"), sql`${walletEntriesTable.status} <> 'void'`)),
    sumWhere(and(eq(walletEntriesTable.owner, "teacher"), sql`${walletEntriesTable.status} <> 'void'`)),
    db
      .select({ v: sql<number>`coalesce(sum(${payoutsTable.amountCents}), 0)` })
      .from(payoutsTable)
      .where(eq(payoutsTable.status, "paid"))
      .then((r) => Number(r[0]?.v ?? 0)),
    db.select({ role: usersTable.role, n: count() }).from(usersTable).where(isNull(usersTable.deletedAt)).groupBy(usersTable.role),
    db.select({ n: count() }).from(lecturesTable),
    db.select({ n: count() }).from(bookingsTable).where(eq(bookingsTable.status, "confirmed")),
    db
      .select({ p: paymentsTable, payer: usersTable, l: lecturesTable })
      .from(paymentsTable)
      .innerJoin(usersTable, eq(usersTable.id, paymentsTable.userId))
      .innerJoin(bookingsTable, eq(bookingsTable.id, paymentsTable.bookingId))
      .innerJoin(lecturesTable, eq(lecturesTable.id, bookingsTable.lectureId))
      .where(inArray(paymentsTable.status, ["succeeded", "refunded"]))
      .orderBy(desc(paymentsTable.createdAt))
      .limit(100),
    db
      .select({ p: payoutsTable, t: usersTable })
      .from(payoutsTable)
      .innerJoin(usersTable, eq(usersTable.id, payoutsTable.teacherId))
      .where(eq(payoutsTable.status, "requested"))
      .orderBy(payoutsTable.createdAt),
    db.select({ p: paymentsTable, payer: usersTable, l: lecturesTable }).from(paymentsTable)
      .innerJoin(usersTable, eq(usersTable.id, paymentsTable.userId))
      .innerJoin(bookingsTable, eq(bookingsTable.id, paymentsTable.bookingId))
      .innerJoin(lecturesTable, eq(lecturesTable.id, bookingsTable.lectureId))
      .where(sql`${paymentsTable.raw}->>'gahezRefundPending' = 'true' or ${paymentsTable.raw}->>'gahezReviewReason' is not null`)
      .orderBy(paymentsTable.createdAt).limit(100),
  ]);
  const teacherIds = [...new Set([...recent, ...reviews].map((r) => r.l.teacherId))];
  const teachers = teacherIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, teacherIds)) : [];
  const teacherBy = new Map(teachers.map((t) => [t.id, t]));
  const byRole = new Map(roles.map((r) => [r.role, Number(r.n)]));
  const toAdminPayment = ({ p, payer, l }: typeof recent[number]) => {
    const flags = (p.raw ?? {}) as Record<string, unknown>;
    return { id: p.id, status: p.status, amountCents: p.amountCents, method: p.method as PaymentMethod | null, provider: p.provider, bookingId: p.bookingId, lectureId: l.id, lectureTitle: l.title, createdAt: p.createdAt.toISOString(), payer: toMini(payer), teacher: toMini(teacherBy.get(l.teacherId) ?? { id: l.teacherId, name: "", avatarUrl: null }), refundPending: Boolean(flags.gahezRefundPending), requiresReview: Boolean(flags.gahezReviewReason) };
  };
  const body: AdminOverviewDTO = {
    gmvCents: gmv,
    platformCents: platform,
    // Teacher entries are already net of payouts (payouts are negative rows).
    teacherPayableCents: teacherPayable,
    paidOutCents: paidOut,
    counts: {
      teachers: byRole.get("teacher") ?? 0,
      students: byRole.get("student") ?? 0,
      parents: byRole.get("parent") ?? 0,
      lectures: Number(lectures[0]?.n ?? 0),
      bookings: Number(bookings[0]?.n ?? 0),
    },
    recentPayments: recent.map(toAdminPayment),
    pendingReviews: reviews.map(toAdminPayment),
    pendingPayouts: pending.map(({ p, t }) => toPayout(p, toMini(t))),
  };
  res.json(body);
});

router.get("/admin/payouts", async (_req, res) => {
  const rows = await db
    .select({ p: payoutsTable, t: usersTable })
    .from(payoutsTable)
    .innerJoin(usersTable, eq(usersTable.id, payoutsTable.teacherId))
    .orderBy(desc(payoutsTable.createdAt))
    .limit(200);
  res.json(rows.map(({ p, t }) => toPayout(p, toMini(t))));
});

router.post("/admin/payouts/:id", async (req, res) => {
  const actor = requireUser(req);
  const id = uuidParam(req.params.id);
  const { status, note } = parse(payoutDecisionSchema, req.body);
  const payout = await db.transaction(async (tx) => {
    // Two decisions at once must not both win: "paid" plus "rejected" would pay and refund.
    const [current] = await tx.select().from(payoutsTable).where(eq(payoutsTable.id, id)).for("update");
    if (!current) throw notFound();
    if (current.status !== "requested") throw badRequest("الطلب ده اتنفّذ قبل كده");
    await tx.update(payoutsTable).set({ status, adminNote: note || null, processedAt: new Date() }).where(eq(payoutsTable.id, id));
    // Rejected: the debit taken at request time is voided, so the money is back.
    if (status === "rejected") await tx.update(walletEntriesTable).set({ status: "void" }).where(eq(walletEntriesTable.payoutId, id));
    await recordAdminAction(tx, actor.id, `payout.${status}`, id, note);
    return current;
  });
  const teacher = await db.query.usersTable.findFirst({ where: eq(usersTable.id, payout.teacherId) });
  await notify([payout.teacherId], {
    kind: "payout",
    title: status === "paid" ? "فلوسك اتحوّلت 💸" : "طلب السحب اترفض",
    body: note,
    link: "/t/wallet",
  });
  if (teacher) void sendPayoutUpdate(teacher, payout.amountCents, status, note);
  const [updated] = await db.select().from(payoutsTable).where(eq(payoutsTable.id, id));
  res.json(toPayout(updated!, teacher ? toMini(teacher) : null));
});

// ---------------------------------------------------------------- earnings under review

router.get("/admin/fund-reviews", async (_req, res) => {
  const lectures = await db
    .select({ l: lecturesTable, t: usersTable })
    .from(lecturesTable)
    .innerJoin(usersTable, eq(usersTable.id, lecturesTable.teacherId))
    .where(and(isNotNull(lecturesTable.fundsReviewReason), isNull(lecturesTable.fundsReviewedAt)))
    .orderBy(asc(lecturesTable.liveEndedAt))
    .limit(100);
  if (lectures.length === 0) return void res.json([]);
  const ids = lectures.map((r) => r.l.id);
  const [amounts, attendees, reports] = await Promise.all([
    db
      .select({ id: bookingsTable.lectureId, total: sql<number>`coalesce(sum(${bookingsTable.pricePaidCents}), 0)` })
      .from(bookingsTable)
      .where(and(inArray(bookingsTable.lectureId, ids), eq(bookingsTable.status, "confirmed")))
      .groupBy(bookingsTable.lectureId),
    db
      .select({ id: attendanceTable.lectureId, n: count() })
      .from(attendanceTable)
      .where(and(inArray(attendanceTable.lectureId, ids), sql`${attendanceTable.liveSeconds} >= ${FUNDS_MIN_ATTENDED_SECONDS}`))
      .groupBy(attendanceTable.lectureId),
    db
      .select({ r: lectureReportsTable, s: usersTable })
      .from(lectureReportsTable)
      .innerJoin(usersTable, eq(usersTable.id, lectureReportsTable.studentId))
      .where(and(inArray(lectureReportsTable.lectureId, ids), eq(lectureReportsTable.status, "open")))
      .orderBy(asc(lectureReportsTable.createdAt)),
  ]);
  const amountBy = new Map(amounts.map((a) => [a.id, Number(a.total)]));
  const attendeesBy = new Map(attendees.map((a) => [a.id, Number(a.n)]));
  const body: FundReviewDTO[] = lectures.map(({ l, t }) => ({
    lecture: {
      id: l.id,
      title: l.title,
      startsAt: l.startsAt.toISOString(),
      durationMin: l.durationMin,
      liveMinutes: l.liveStartedAt && l.liveEndedAt ? Math.round((l.liveEndedAt.getTime() - l.liveStartedAt.getTime()) / 60_000) : 0,
      attendees: attendeesBy.get(l.id) ?? 0,
    },
    teacher: toMini(t),
    reason: l.fundsReviewReason!,
    amountCents: amountBy.get(l.id) ?? 0,
    reports: reports.filter((r) => r.r.lectureId === l.id).map(({ r, s }) => ({ id: r.id, reason: r.reason, details: r.details, student: toMini(s), createdAt: r.createdAt.toISOString() })),
  }));
  res.json(body);
});

router.post("/admin/lectures/:id/funds", async (req, res) => {
  const { decision, note } = parse(fundsDecisionSchema, req.body);
  await decideLectureFunds(uuidParam(req.params.id), requireUser(req), decision, note);
  res.json({ ok: true });
});

router.post("/admin/reports/:id", async (req, res) => {
  const { decision, note } = parse(reportDecisionSchema, req.body);
  await resolveLectureReport(uuidParam(req.params.id), requireUser(req), decision, note);
  res.json({ ok: true });
});

export default router;
