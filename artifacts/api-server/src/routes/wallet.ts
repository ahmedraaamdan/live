import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db, lecturesTable, payoutsTable, usersTable, walletEntriesTable } from "@workspace/db";
import { payoutRequestSchema, type WalletDTO } from "@workspace/live-core";
import { requireRole } from "../lib/auth";
import { toPayout } from "../lib/dto";
import { env } from "../lib/env";
import { badRequest, forbidden, parse } from "../lib/http";
import { teacherBalances } from "../lib/ledger";
import { notify } from "../lib/notify";
import { assertVerifiedTeacher } from "../lib/teacher-verification";
import { and } from "drizzle-orm";

const router = Router();

async function walletOf(teacherId: string): Promise<WalletDTO> {
  const [balances, entries, payouts] = await Promise.all([
    teacherBalances(teacherId),
    db
      .select({ e: walletEntriesTable, title: lecturesTable.title })
      .from(walletEntriesTable)
      .leftJoin(lecturesTable, eq(lecturesTable.id, walletEntriesTable.lectureId))
      .where(and(eq(walletEntriesTable.owner, "teacher"), eq(walletEntriesTable.teacherId, teacherId)))
      .orderBy(desc(walletEntriesTable.createdAt))
      .limit(100),
    db.select().from(payoutsTable).where(eq(payoutsTable.teacherId, teacherId)).orderBy(desc(payoutsTable.createdAt)).limit(50),
  ]);
  return {
    ...balances,
    feeBps: env.feeBps,
    entries: entries.map(({ e, title }) => ({
      id: e.id,
      kind: e.kind,
      amountCents: e.amountCents,
      status: e.status,
      memo: e.memo,
      lectureTitle: title,
      createdAt: e.createdAt.toISOString(),
    })),
    payouts: payouts.map((p) => toPayout(p)),
  };
}

router.get("/wallet", async (req, res) => {
  const user = requireRole(req, "teacher");
  res.json(await walletOf(user.id));
});

router.post("/wallet/payouts", async (req, res) => {
  const user = requireRole(req, "teacher");
  if (req.impersonation) throw forbidden("لا يمكن طلب سحب أثناء تبديل الحساب");
  await assertVerifiedTeacher(user);
  const input = parse(payoutRequestSchema, req.body);
  await db.transaction(async (tx) => {
    // Lock a row that always exists, including before the first payout request.
    await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, user.id)).for("update");
    const { availableCents } = await teacherBalances(user.id, tx);
    if (input.amountCents > availableCents) throw badRequest("المبلغ أكبر من رصيدك المتاح");
    const [payout] = await tx
      .insert(payoutsTable)
      .values({ teacherId: user.id, amountCents: input.amountCents, method: input.method, account: input.account })
      .returning();
    await tx.insert(walletEntriesTable).values({
      owner: "teacher",
      teacherId: user.id,
      kind: "payout",
      amountCents: -input.amountCents,
      status: "available",
      payoutId: payout!.id,
      memo: "طلب سحب",
    });
  });
  const admins = await db.query.usersTable.findMany({ where: (u, { eq }) => eq(u.role, "admin") });
  await notify(admins.map((a) => a.id), { kind: "payout", title: `طلب سحب جديد من ${user.name}`, link: "/admin/payouts" });
  res.status(201).json(await walletOf(user.id));
});

export default router;
