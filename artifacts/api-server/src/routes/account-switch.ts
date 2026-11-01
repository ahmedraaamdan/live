import { Router } from "express";
import { and, desc, eq, gt, ilike, isNull, or } from "drizzle-orm";
import { accountSwitchesTable, db, sessionsTable, usersTable } from "@workspace/db";
import { bearer, destroySession, randomToken, requireSuperAdmin, requireUser, sha256 } from "../lib/auth";
import { loadMe, toUser } from "../lib/dto";
import { badRequest, forbidden, notFound, uuidParam } from "../lib/http";
import { logger } from "../lib/logger";

const router = Router();
router.get("/auth/switch/users", async (req, res) => {
  const actor = requireSuperAdmin(req);
  const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await db.select().from(usersTable).where(and(isNull(usersTable.deletedAt), query ? or(ilike(usersTable.name, pattern), ilike(usersTable.email, pattern), ilike(usersTable.phone, pattern)) : undefined)).orderBy(desc(usersTable.createdAt)).limit(50);
  res.json(rows.filter(u => u.id !== actor.id).map(u => ({ ...toUser(u), suspended: u.suspended })));
});
router.post("/auth/switch/:id/start", async (req, res) => {
  const actor = requireSuperAdmin(req);
  const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, uuidParam(req.params.id)) });
  if (!target) throw notFound();
  if (target.id === actor.id) throw badRequest("أنت تستخدم حسابك بالفعل");
  const parentHash = sha256(bearer(req)!);
  const token = randomToken();
  const switchId = await db.transaction(async tx => {
    const [parent] = await tx.select().from(sessionsTable).where(and(eq(sessionsTable.tokenHash, parentHash), gt(sessionsTable.expiresAt, new Date()))).for("update");
    if (!parent || parent.actorTokenHash) throw forbidden();
    const [audit] = await tx.insert(accountSwitchesTable).values({ actorId: actor.id, targetId: target.id }).returning();
    await tx.insert(sessionsTable).values({ tokenHash: sha256(token), userId: target.id, actorTokenHash: parentHash, switchId: audit!.id, userAgent: req.headers["user-agent"]?.slice(0, 300), expiresAt: new Date(Math.min(parent.expiresAt.getTime(), Date.now() + 3_600_000)) });
    return audit!.id;
  });
  logger.info({ actorId: actor.id, targetId: target.id, switchId }, "Account switch started");
  res.json({ token, me: await loadMe(target, { actor }) });
});
router.post("/auth/switch/stop", async (req, res) => {
  requireUser(req);
  if (!req.impersonation) throw badRequest("لا توجد جلسة تبديل نشطة");
  await destroySession(bearer(req)!);
  logger.info({ actorId: req.impersonation.actor.id, targetId: req.user!.id, switchId: req.impersonation.switchId }, "Account switch ended");
  // Never exchange a target token for an administrator token. The owner must
  // still possess the original administrator session in this browser.
  res.json({ ok: true });
});
export default router;
