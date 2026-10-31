import { createMfaChallenge } from "../lib/mfa-auth";
import { assertOwnedMediaUrl } from "../lib/profile-media";
import { Router } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import {
  db,
  parentLinksTable,
  passwordResetsTable,
  sessionsTable,
  studentProfilesTable,
  teacherProfilesTable,
  usersTable,
  userSecurityTable,
} from "@workspace/db";
import {
  forgotSchema,
  loginSchema,
  parentInviteSchema,
  profileUpdateSchema,
  resetSchema,
  signupSchema,
  type AuthResult,
} from "@workspace/live-core";
import { bearer, createSession, destroySession, hashPassword, randomToken, requireRole, requireUser, sha256, verifyPassword } from "../lib/auth";
import { shortCode } from "../lib/codes";
import { loadMe } from "../lib/dto";
import { sendParentInvite, sendPasswordReset, sendWelcome } from "../lib/emails";
import { env } from "../lib/env";
import { badRequest, conflict, parse, unauthorized } from "../lib/http";
import { allow, enforce, forgive, LIMITS } from "../lib/rate-limit";

const router = Router();

async function uniqueLinkCode(): Promise<string> {
  for (;;) {
    const code = shortCode(6);
    const taken = await db.query.studentProfilesTable.findFirst({ where: eq(studentProfilesTable.linkCode, code) });
    if (!taken) return code;
  }
}

router.post("/auth/signup", async (req, res) => {
  enforce(LIMITS.signupIp, String(req.ip));
  const input = parse(signupSchema, req.body);
  const exists = await db.query.usersTable.findFirst({ where: eq(usersTable.email, input.email) });
  if (exists) throw conflict("الإيميل ده عليه حساب بالفعل، سجّل دخول", "email_taken");

  // Public registration cannot grant administrator privileges based on an unverified email.
  // Existing admin accounts retain their role; provisioning is an operator action.
  const role = input.role;
  const passwordHash = await hashPassword(input.password);
  const childCode = input.childCode?.toUpperCase();
  // Before the transaction: it queries outside it, and must not wait on it.
  const linkCode = role === "student" ? await uniqueLinkCode() : "";

  const user = await db.transaction(async (tx) => {
    const [u] = await tx.insert(usersTable).values({ role, name: input.name, email: input.email, phone: input.phone, passwordHash }).returning();
    if (role === "teacher") await tx.insert(teacherProfilesTable).values({ userId: u!.id, subject: input.subject });
    if (role === "student")
      await tx.insert(studentProfilesTable).values({ userId: u!.id, grade: input.grade, parentEmail: input.parentEmail, linkCode });
    if (role === "parent" && childCode) {
      const child = await tx.query.studentProfilesTable.findFirst({ where: eq(studentProfilesTable.linkCode, childCode) });
      if (!child) throw badRequest("رمز ربط الطالب غير صحيح. تحقّق منه ثم حاول مجددًا.");
      await tx.insert(parentLinksTable).values({ parentId: u!.id, studentId: child.userId }).onConflictDoNothing();
    }
    return u!;
  });

  if (user.role === "student" && input.parentEmail) {
    const profile = await db.query.studentProfilesTable.findFirst({ where: eq(studentProfilesTable.userId, user.id) });
    void sendParentInvite({ student: user, email: input.parentEmail, code: profile!.linkCode });
  }
  void sendWelcome(user);

  const token = await createSession(user.id, req.headers["user-agent"]);
  const body: AuthResult = { token, me: await loadMe(user) };
  res.status(201).json(body);
});

router.post("/auth/login", async (req, res) => {
  const input = parse(loginSchema, req.body);
  const attempt = `${input.email}|${req.ip}`;
  enforce(LIMITS.loginIp, String(req.ip));
  enforce(LIMITS.loginEmail, input.email);
  enforce(LIMITS.loginAttempt, attempt, "محاولات دخول كثيرة. انتظر 15 دقيقة أو أعد تعيين كلمة المرور.");
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.email, input.email) });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) throw unauthorized("الإيميل أو الباسورد غلط");
  forgive(LIMITS.loginAttempt, attempt);
  if (user.suspended) throw unauthorized("الحساب ده موقوف، كلّمنا على support@gahez.space");
  const security = await db.query.userSecurityTable.findFirst({ where: eq(userSecurityTable.userId, user.id) });
  if (security?.totpEnabledAt) return void res.json({ requiresMfa: true, challenge: await createMfaChallenge(user.id) });
  const token = await createSession(user.id, req.headers["user-agent"]);
  const body: AuthResult = { token, me: await loadMe(user) };
  res.json(body);
});

router.post("/auth/logout", async (req, res) => {
  const token = bearer(req);
  if (token) await destroySession(token);
  if (req.impersonation) await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, req.impersonation.parentHash));
  res.json({ ok: true });
});

router.post("/auth/forgot", async (req, res) => {
  enforce(LIMITS.forgotIp, String(req.ip));
  const { email } = parse(forgotSchema, req.body);
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.email, email) });
  // Same answer either way, so the endpoint doesn't reveal who has an account.
  // Past the budget nothing is sent, which also stops it filling someone's inbox.
  if (user && allow(LIMITS.forgotEmail, email)) {
    const token = randomToken();
    await db.insert(passwordResetsTable).values({ tokenHash: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + 3_600_000) });
    void sendPasswordReset(user, token);
  }
  res.json({ ok: true });
});

router.post("/auth/reset", async (req, res) => {
  enforce(LIMITS.resetIp, String(req.ip));
  const { token, password } = parse(resetSchema, req.body);
  const reset = await db.query.passwordResetsTable.findFirst({
    where: and(eq(passwordResetsTable.tokenHash, sha256(token)), gt(passwordResetsTable.expiresAt, new Date()), isNull(passwordResetsTable.usedAt)),
  });
  if (!reset) throw badRequest("اللينك ده خلص أو اتستخدم قبل كده، اطلب لينك جديد");
  await db.transaction(async (tx) => {
    await tx.update(usersTable).set({ passwordHash: await hashPassword(password) }).where(eq(usersTable.id, reset.userId));
    await tx.update(passwordResetsTable).set({ usedAt: new Date() }).where(eq(passwordResetsTable.tokenHash, reset.tokenHash));
    // Signs out every device: whoever had the old password is out.
    await tx.delete(sessionsTable).where(eq(sessionsTable.userId, reset.userId));
  });
  res.json({ ok: true });
});

router.get("/me", async (req, res) => {
  res.json(await loadMe(requireUser(req), req.impersonation));
});

router.patch("/me", async (req, res) => {
  const user = requireUser(req);
  const input = parse(profileUpdateSchema, req.body);
  // Only touch the tables that have changes: drizzle refuses an empty update.
  await assertOwnedMediaUrl(user.id, input.avatarUrl, true);
  if (user.role === "teacher") {
    for (const link of [...(input.certificates ?? []), ...(input.socialLinks ?? [])]) await assertOwnedMediaUrl(user.id, link.url);
  }
  const userSet = {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.phone !== undefined && { phone: input.phone ?? null }),
    ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl || null }),
  };
  const teacherSet = {
    ...(input.experience !== undefined && { experience: input.experience }),
    ...(input.socialLinks !== undefined && { socialLinks: input.socialLinks }),
    ...(input.certificates !== undefined && { certificates: input.certificates }),
    ...(input.bio !== undefined && { bio: input.bio }),
    ...(input.headline !== undefined && { headline: input.headline }),
    ...(input.subject !== undefined && { subject: input.subject }),
  };
  const studentSet = {
    ...(input.grade !== undefined && { grade: input.grade }),
    ...(input.parentEmail !== undefined && { parentEmail: input.parentEmail ?? null }),
  };
  const updated = await db.transaction(async tx => {
    let current = user;
    if (Object.keys(userSet).length) [current] = await tx.update(usersTable).set(userSet).where(eq(usersTable.id, user.id)).returning() as [typeof user];
    if (user.role === "teacher" && Object.keys(teacherSet).length)
      await tx.insert(teacherProfilesTable).values({ userId: user.id, ...teacherSet }).onConflictDoUpdate({ target: teacherProfilesTable.userId, set: teacherSet });
    if (user.role === "student" && Object.keys(studentSet).length)
      await tx.update(studentProfilesTable).set(studentSet).where(eq(studentProfilesTable.userId, user.id));
    return current;
  });
  res.json(await loadMe(updated, req.impersonation));
});

/** A student (re)sends the invitation to their parent's email. */
router.post("/me/parent-invite", async (req, res) => {
  const user = requireRole(req, "student");
  enforce(LIMITS.parentInvite, user.id);
  const { email } = parse(parentInviteSchema, req.body);
  const profile = await db.query.studentProfilesTable.findFirst({ where: eq(studentProfilesTable.userId, user.id) });
  await db.update(studentProfilesTable).set({ parentEmail: email }).where(eq(studentProfilesTable.userId, user.id));
  await sendParentInvite({ student: user, email, code: profile!.linkCode });
  res.json({ ok: true });
});

export default router;
