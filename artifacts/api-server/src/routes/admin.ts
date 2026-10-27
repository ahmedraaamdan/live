import { Router } from "express";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { bookingsTable, db, lecturesTable, paymentsTable, payoutsTable, usersTable, walletEntriesTable } from "@workspace/db";
import { payoutDecisionSchema, type AdminOverviewDTO, type AdminUserDTO, type PaymentMethod, type Role } from "@workspace/live-core";
import { roleGate } from "../lib/auth";
import { toMini, toPayout, toUser } from "../lib/dto";
import { sendPayoutUpdate } from "../lib/emails";
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
  const [gmv, platform, teacherPayable, paidOut, roles, lectures, bookings, recent, pending] = await Promise.all([
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
    db.select({ role: usersTable.role, n: count() }).from(usersTable).groupBy(usersTable.role),
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
      .limit(20),
    db
      .select({ p: payoutsTable, t: usersTable })
      .from(payoutsTable)
      .innerJoin(usersTable, eq(usersTable.id, payoutsTable.teacherId))
      .where(eq(payoutsTable.status, "requested"))
      .orderBy(payoutsTable.createdAt),
  ]);
  const teacherIds = [...new Set(recent.map((r) => r.l.teacherId))];
  const teachers = teacherIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, teacherIds)) : [];
  const teacherBy = new Map(teachers.map((t) => [t.id, t]));
  const byRole = new Map(roles.map((r) => [r.role, Number(r.n)]));
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
    recentPayments: recent.map(({ p, payer, l }) => ({
      id: p.id,
      status: p.status,
      amountCents: p.amountCents,
      method: p.method as PaymentMethod | null,
      provider: p.provider,
      bookingId: p.bookingId,
      lectureId: l.id,
      lectureTitle: l.title,
      createdAt: p.createdAt.toISOString(),
      payer: toMini(payer),
      teacher: toMini(teacherBy.get(l.teacherId) ?? { id: l.teacherId, name: "", avatarUrl: null }),
    })),
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
  const id = uuidParam(req.params.id);
  const { status, note } = parse(payoutDecisionSchema, req.body);
  const payout = await db.query.payoutsTable.findFirst({ where: eq(payoutsTable.id, id) });
  if (!payout) throw notFound();
  if (payout.status !== "requested") throw badRequest("الطلب ده اتنفّذ قبل كده");
  await db.transaction(async (tx) => {
    await tx.update(payoutsTable).set({ status, adminNote: note || null, processedAt: new Date() }).where(eq(payoutsTable.id, id));
    // Rejected: the debit taken at request time is voided, so the money is back.
    if (status === "rejected") await tx.update(walletEntriesTable).set({ status: "void" }).where(eq(walletEntriesTable.payoutId, id));
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

router.get("/admin/users", async (req, res) => {
  const role = typeof req.query.role === "string" ? (req.query.role as Role) : undefined;
  const users = await db
    .select()
    .from(usersTable)
    .where(role ? eq(usersTable.role, role) : undefined)
    .orderBy(desc(usersTable.createdAt))
    .limit(300);
  const ids = users.map((u) => u.id);
  const [lec, book] = ids.length
    ? await Promise.all([
        db.select({ id: lecturesTable.teacherId, n: count() }).from(lecturesTable).where(inArray(lecturesTable.teacherId, ids)).groupBy(lecturesTable.teacherId),
        db
          .select({ id: bookingsTable.studentId, n: count() })
          .from(bookingsTable)
          .where(and(inArray(bookingsTable.studentId, ids), eq(bookingsTable.status, "confirmed")))
          .groupBy(bookingsTable.studentId),
      ])
    : [[], []];
  const l = new Map(lec.map((x) => [x.id, Number(x.n)]));
  const b = new Map(book.map((x) => [x.id, Number(x.n)]));
  const body: AdminUserDTO[] = users.map((u) => ({ ...toUser(u), lectures: l.get(u.id) ?? 0, bookings: b.get(u.id) ?? 0 }));
  res.json(body);
});

router.post("/admin/users/:id/suspend", async (req, res) => {
  const id = uuidParam(req.params.id);
  const suspended = Boolean(req.body?.suspended);
  await db.update(usersTable).set({ suspended }).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

export default router;
