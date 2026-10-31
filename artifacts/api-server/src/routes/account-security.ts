import { Router } from "express";
import { and, eq, gt, ne } from "drizzle-orm";
import { z } from "zod/v4";
import { db, securityChallengesTable, userSecurityTable, sessionsTable, usersTable, teacherVerificationsTable } from "@workspace/db";
import { bearer, createSession, requireRole, sha256, verifyPassword } from "../lib/auth";
import { badRequest, parse, unauthorized } from "../lib/http";
import { enforce, LIMITS } from "../lib/rate-limit";
import { accountSecurity, requireDirectAccount } from "../lib/teacher-verification";
import { loadMe } from "../lib/dto";
import { consumeMfa } from "../lib/mfa-auth";
import { newRecoveryCodes, newTotpSecret, openSecret, recoveryDigest, sealSecret, totpStep } from "../lib/two-factor";
const router = Router();
const codeSchema = z.object({ code: z.string().trim().min(6).max(40) });
router.get("/me/security", async (req, res) => { const user = requireRole(req, "teacher", "admin"); res.json(await accountSecurity(user.id, !req.impersonation)); });
router.post("/me/security/mfa/setup", async (req, res) => {
  const user = requireRole(req, "teacher", "admin"); requireDirectAccount(req);
  const { password } = parse(z.object({ password: z.string().max(500) }), req.body);
  if (!(await verifyPassword(password, user.passwordHash))) throw badRequest("كلمة المرور غير صحيحة");
  const existing = await db.query.userSecurityTable.findFirst({ where: eq(userSecurityTable.userId, user.id) });
  if (existing?.totpEnabledAt) throw badRequest("المصادقة الثنائية مفعّلة بالفعل");
  const secret = newTotpSecret(), expiresAt = new Date(Date.now() + 10 * 60000);
  await db.insert(userSecurityTable).values({ userId: user.id, pendingTotpSecretEnc: sealSecret(secret), pendingTotpExpiresAt: expiresAt }).onConflictDoUpdate({ target: userSecurityTable.userId, set: { pendingTotpSecretEnc: sealSecret(secret), pendingTotpExpiresAt: expiresAt } });
  res.json({ secret, uri: `otpauth://totp/${encodeURIComponent(`Gahez Live:${user.email}`)}?secret=${secret}&issuer=Gahez%20Live&algorithm=SHA1&digits=6&period=30` });
});
router.post("/me/security/mfa/confirm", async (req, res) => {
  const user = requireRole(req, "teacher", "admin"); requireDirectAccount(req);
  const { code } = parse(codeSchema, req.body);
  const codes = newRecoveryCodes();
  await db.transaction(async tx => {
    const [row] = await tx.select().from(userSecurityTable).where(eq(userSecurityTable.userId, user.id)).for("update");
    if (row?.totpEnabledAt || !row?.pendingTotpSecretEnc || !row.pendingTotpExpiresAt || row.pendingTotpExpiresAt.getTime() <= Date.now()) throw badRequest("انتهى إعداد المصادقة. ابدأ مجددًا.");
    const step = totpStep(openSecret(row.pendingTotpSecretEnc), code.replace(/\s/g, ""));
    if (step === null) throw badRequest("الرمز غير صحيح. تحقّق من تطبيق المصادقة.");
    await tx.update(userSecurityTable).set({ totpSecretEnc: row.pendingTotpSecretEnc, totpEnabledAt: new Date(), pendingTotpSecretEnc: null, pendingTotpExpiresAt: null, lastTotpStep: step, recoveryHashes: codes.map(recoveryDigest), mfaFailures: 0, mfaLockedUntil: null }).where(eq(userSecurityTable.userId, user.id));
    // The current session just proved password + TOTP. Other sessions must authenticate again.
    await tx.delete(sessionsTable).where(and(eq(sessionsTable.userId, user.id), ne(sessionsTable.tokenHash, sha256(bearer(req)!))));
  });
  res.json({ recoveryCodes: codes });
});
router.post("/auth/mfa", async (req, res) => {
  enforce(LIMITS.mfaIp, String(req.ip));
  const { challenge, code } = parse(codeSchema.extend({ challenge: z.string().min(30).max(100) }), req.body);
  const pending = await db.query.securityChallengesTable.findFirst({ where: and(eq(securityChallengesTable.tokenHash, sha256(challenge)), eq(securityChallengesTable.purpose, "login"), gt(securityChallengesTable.expiresAt, new Date())) });
  if (!pending) throw badRequest("انتهت محاولة الدخول. أدخل كلمة المرور مجددًا.");
  const result = await consumeMfa(pending.userId, code, challenge);
  if (!result.ok) throw badRequest(result.error);
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, pending.userId) });
  if (!user || user.suspended) throw unauthorized("الحساب غير متاح");
  res.json({ token: await createSession(user.id, req.headers["user-agent"]), me: await loadMe(user) });
});
router.post("/me/security/mfa/disable", async (req, res) => {
  const user = requireRole(req, "teacher", "admin"); requireDirectAccount(req);
  const { code, password } = parse(codeSchema.extend({ password: z.string().max(500) }), req.body);
  if (!(await verifyPassword(password, user.passwordHash))) throw badRequest("كلمة المرور غير صحيحة");
  const result = await consumeMfa(user.id, code); if (!result.ok) throw badRequest(result.error);
  await db.transaction(async tx => {
    await tx.update(userSecurityTable).set({ totpSecretEnc: null, totpEnabledAt: null, recoveryHashes: [], pendingTotpSecretEnc: null, pendingTotpExpiresAt: null }).where(eq(userSecurityTable.userId, user.id));
    await tx.update(teacherVerificationsTable).set({ status: "needs_changes", note: "أُوقفت المصادقة الثنائية. أعد تفعيلها ثم أرسل طلب التوثيق مجددًا.", reviewedAt: new Date() }).where(eq(teacherVerificationsTable.teacherId, user.id));
  });
  res.json({ ok: true });
});
export default router;
