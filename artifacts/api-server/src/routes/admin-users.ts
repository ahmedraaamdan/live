import { Router } from "express";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { bookingsTable, db, lecturesTable, passwordResetsTable, sessionsTable, userSecurityTable, usersTable } from "@workspace/db";
import { DELETE_CONFIRM_WORD, adminUsersBulkSchema, adminUsersExportSchema, type AdminUserDetailDTO, type AdminUsersBulkResult, type Role } from "@workspace/live-core";
import { deviceLabel, loadAdminUsers, userTimeline, usersSheet } from "../lib/admin-users";
import { recordAdminAction } from "../lib/audit";
import { isSuperAdmin, randomToken, requireSuperAdmin, requireUser, roleGate, sha256 } from "../lib/auth";
import { sendPasswordReset } from "../lib/emails";
import { badRequest, forbidden, notFound, parse, uuidParam } from "../lib/http";
import { allow, LIMITS } from "../lib/rate-limit";
import { removeUser } from "../lib/user-removal";
import { buildXlsx } from "../lib/xlsx";

const router = Router();
router.use("/admin/users", roleGate("admin"));

router.get("/admin/users", async (req, res) => {
  const role = typeof req.query.role === "string" ? (req.query.role as Role) : undefined;
  const { rows } = await loadAdminUsers({ role });
  res.json(rows);
});

router.get("/admin/users/:id", async (req, res) => {
  const id = uuidParam(req.params.id);
  const { rows, facts } = await loadAdminUsers({ ids: [id] });
  const user = rows[0];
  if (!user) throw notFound();
  const [sessions, security, lectures, bookings] = await Promise.all([
    db.select().from(sessionsTable).where(eq(sessionsTable.userId, id)).orderBy(desc(sessionsTable.createdAt)).limit(10),
    db.query.userSecurityTable.findFirst({ where: eq(userSecurityTable.userId, id) }),
    db.select().from(lecturesTable).where(eq(lecturesTable.teacherId, id)).orderBy(desc(lecturesTable.startsAt)).limit(10),
    db
      .select({ b: bookingsTable, title: lecturesTable.title })
      .from(bookingsTable)
      .innerJoin(lecturesTable, eq(lecturesTable.id, bookingsTable.lectureId))
      .where(eq(bookingsTable.studentId, id))
      .orderBy(desc(bookingsTable.createdAt))
      .limit(10),
  ]);
  const seats = lectures.length
    ? await db.select({ id: bookingsTable.lectureId, n: count() }).from(bookingsTable).where(and(inArray(bookingsTable.lectureId, lectures.map((l) => l.id)), eq(bookingsTable.status, "confirmed"))).groupBy(bookingsTable.lectureId)
    : [];
  const seatsBy = new Map(seats.map((s) => [s.id, Number(s.n)]));
  const body: AdminUserDetailDTO = {
    user,
    timeline: userTimeline({ role: user.role, createdAt: new Date(user.createdAt) }, facts.get(id) ?? {}),
    sessions: sessions.map((s) => ({ device: deviceLabel(s.userAgent) ?? "غير معروف", at: s.createdAt.toISOString(), support: Boolean(s.actorTokenHash) })),
    lectures: lectures.map((l) => ({ id: l.id, title: l.title, status: l.status, startsAt: l.startsAt.toISOString(), priceCents: l.priceCents, bookings: seatsBy.get(l.id) ?? 0 })),
    bookings: bookings.map(({ b, title }) => ({ lectureId: b.lectureId, title, status: b.status, pricePaidCents: b.pricePaidCents, createdAt: b.createdAt.toISOString() })),
    security: security ? { google: security.googleEmail, facebook: security.facebookName, mfaEnabled: Boolean(security.totpEnabledAt && security.totpSecretEnc) } : null,
  };
  res.json(body);
});

/** Stops or restores one account; the owner's stays out of reach. */
async function setSuspended(id: string, suspended: boolean, actor: { id: string }): Promise<string | null> {
  if (id === actor.id) return "لا يمكنك إيقاف حسابك.";
  const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, id) });
  if (!target || target.deletedAt) return "الحساب مش موجود.";
  if (isSuperAdmin(target)) return "لا يمكن إيقاف حساب المالك.";
  await db.transaction(async (tx) => {
    await tx.update(usersTable).set({ suspended }).where(eq(usersTable.id, id));
    await recordAdminAction(tx, actor.id, suspended ? "user.suspend" : "user.restore", id);
  });
  return null;
}

router.post("/admin/users/:id/suspend", async (req, res) => {
  const actor = requireUser(req);
  const id = uuidParam(req.params.id);
  const refused = await setSuspended(id, Boolean(req.body?.suspended), actor);
  if (refused === "الحساب مش موجود.") throw notFound();
  if (refused === "لا يمكنك إيقاف حسابك.") throw badRequest(refused);
  if (refused) throw forbidden(refused);
  res.json({ ok: true });
});

router.post("/admin/users/:id/password-reset", async (req, res) => {
  const actor = requireUser(req);
  const id = uuidParam(req.params.id);
  const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, id) });
  if (!target || target.deletedAt) throw notFound();
  if (!allow(LIMITS.forgotEmail, target.email)) throw badRequest("اتبعتله روابط كتير. استنى شوية وجرّب تاني.");
  const token = randomToken();
  await db.transaction(async (tx) => {
    await tx.insert(passwordResetsTable).values({ tokenHash: sha256(token), userId: target.id, expiresAt: new Date(Date.now() + 3_600_000) });
    await recordAdminAction(tx, actor.id, "user.password_reset", id);
  });
  void sendPasswordReset(target, token);
  res.json({ ok: true });
});

router.post("/admin/users/bulk", async (req, res) => {
  const { action, ids, confirm } = parse(adminUsersBulkSchema, req.body);
  const actor = action === "delete" ? requireSuperAdmin(req) : requireUser(req);
  if (action === "delete" && confirm !== DELETE_CONFIRM_WORD) throw badRequest(`اكتب "${DELETE_CONFIRM_WORD}" لتأكيد الحذف`);
  const unique = [...new Set(ids)];
  const named = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, unique));
  const nameBy = new Map(named.map((u) => [u.id, u.name]));
  const results: AdminUsersBulkResult["results"] = [];
  // One at a time: each account has its own checks, and one refusal must not undo the others.
  for (const id of unique) {
    const name = nameBy.get(id) ?? "";
    if (action === "delete") {
      const removed = await removeUser(id, actor);
      results.push({ id, name, ...removed });
    } else {
      const refused = await setSuspended(id, action === "suspend", actor);
      results.push(refused ? { id, name, outcome: "skipped", reason: refused } : { id, name, outcome: action === "suspend" ? "suspended" : "restored" });
    }
  }
  const body: AdminUsersBulkResult = { results };
  res.json(body);
});

router.post("/admin/users/export", async (req, res) => {
  const actor = requireSuperAdmin(req);
  const { ids } = parse(adminUsersExportSchema, req.body ?? {});
  const { rows } = await loadAdminUsers(ids ? { ids } : {});
  await recordAdminAction(db, actor.id, "user.export", "users", String(rows.length));
  const day = new Date().toISOString().slice(0, 10);
  res
    .set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="gahez-live-users-${day}.xlsx"`,
      "Cache-Control": "private, no-store",
    })
    .send(buildXlsx(usersSheet(rows)));
});

export default router;
