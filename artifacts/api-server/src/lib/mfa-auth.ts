import { and, eq, gt, lt } from "drizzle-orm";
import { db, securityChallengesTable, userSecurityTable } from "@workspace/db";
import { randomToken, sha256 } from "./auth";
import { openSecret, recoveryDigest, totpStep } from "./two-factor";

export async function createMfaChallenge(userId: string) {
  const challenge = randomToken();
  await db.delete(securityChallengesTable).where(and(eq(securityChallengesTable.userId, userId), eq(securityChallengesTable.purpose, "login")));
  await db.insert(securityChallengesTable).values({ tokenHash: sha256(challenge), userId, purpose: "login", expiresAt: new Date(Date.now() + 5 * 60000) });
  return challenge;
}
/** Returns an error as data: failed-attempt updates must commit, never roll back with a thrown error. */
export async function consumeMfa(userId: string, code: string, challenge?: string) {
  return db.transaction(async tx => {
    const [security] = await tx.select().from(userSecurityTable).where(eq(userSecurityTable.userId, userId)).for("update");
    if (!security?.totpSecretEnc || !security.totpEnabledAt) return { ok: false as const, error: "المصادقة الثنائية غير مفعّلة" };
    if (security.mfaLockedUntil && security.mfaLockedUntil.getTime() > Date.now()) return { ok: false as const, error: "محاولات كثيرة. حاول بعد 15 دقيقة." };
    if (challenge) {
      const row = await tx.query.securityChallengesTable.findFirst({ where: and(eq(securityChallengesTable.tokenHash, sha256(challenge)), eq(securityChallengesTable.userId, userId), eq(securityChallengesTable.purpose, "login"), gt(securityChallengesTable.expiresAt, new Date())) });
      if (!row) return { ok: false as const, error: "انتهت محاولة الدخول. أدخل كلمة المرور مجددًا." };
    }
    const normalized = code.replace(/\s/g, "");
    const step = totpStep(openSecret(security.totpSecretEnc), normalized, security.lastTotpStep);
    const digest = recoveryDigest(normalized), recoveryIndex = security.recoveryHashes.indexOf(digest);
    if (step === null && recoveryIndex < 0) {
      const failures = (security.mfaLockedUntil ? 0 : security.mfaFailures) + 1;
      await tx.update(userSecurityTable).set({ mfaFailures: failures, mfaLockedUntil: failures >= 5 ? new Date(Date.now() + 15 * 60000) : null }).where(eq(userSecurityTable.userId, userId));
      return { ok: false as const, error: "الرمز غير صحيح أو استُخدم. جرّب الرمز الجديد." };
    }
    await tx.update(userSecurityTable).set({ lastTotpStep: step ?? security.lastTotpStep, recoveryHashes: recoveryIndex >= 0 ? security.recoveryHashes.filter((_, i) => i !== recoveryIndex) : security.recoveryHashes, mfaFailures: 0, mfaLockedUntil: null }).where(eq(userSecurityTable.userId, userId));
    if (challenge) await tx.delete(securityChallengesTable).where(eq(securityChallengesTable.tokenHash, sha256(challenge)));
    return { ok: true as const };
  });
}
