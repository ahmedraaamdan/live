/**
 * Removing an account. One with no class or money history is deleted outright. One
 * with history is erased: every personal detail goes and the email is free to sign up
 * again, while the row stays because other people's bookings and the ledger point at it.
 */
import { unlink } from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, notExists, or, sql } from "drizzle-orm";
import {
  bookingsTable,
  db,
  lectureReportsTable,
  lecturesTable,
  notificationsTable,
  parentLinksTable,
  passwordResetsTable,
  payoutsTable,
  savedLecturesTable,
  securityChallengesTable,
  sessionsTable,
  studentProfilesTable,
  teacherFollowsTable,
  teacherProfilesTable,
  teacherVerificationsTable,
  uploadsTable,
  userSecurityTable,
  usersTable,
  verificationDocumentsTable,
  verificationReviewsTable,
  walletEntriesTable,
  type Lecture,
  type User,
} from "@workspace/db";
import { recordAdminAction } from "./audit";
import { hashPassword, isSuperAdmin, randomToken } from "./auth";
import { settleCancelledLecture } from "./bookings";
import { env } from "./env";
import { teacherBalances, type Tx } from "./ledger";
import { logger } from "./logger";
import { fmtMoney } from "./format";

export type RemovalResult = { outcome: "deleted" | "erased" } | { outcome: "skipped"; reason: string };

/** What stops an account being removed: money still owed, or classes people are counting on. */
async function blocker(tx: Tx, user: User, actor: User): Promise<string | null> {
  if (user.id === actor.id) return "مينفعش تحذف حسابك وإنت داخل بيه.";
  if (isSuperAdmin(user)) return "مينفعش تحذف حساب المالك.";
  const open = sql`(${lecturesTable.status} = 'live' or (${lecturesTable.status} = 'scheduled' and ${lecturesTable.startsAt} + make_interval(mins => ${lecturesTable.durationMin}) > now()))`;
  if (user.role === "teacher") {
    const balance = await teacherBalances(user.id, tx);
    const owed = balance.availableCents + balance.pendingCents;
    if (owed !== 0) return `عنده رصيد ${fmtMoney(owed)}. سوّي فلوسه الأول.`;
    const [payout] = await tx.select({ id: payoutsTable.id }).from(payoutsTable).where(and(eq(payoutsTable.teacherId, user.id), eq(payoutsTable.status, "requested"))).limit(1);
    if (payout) return "عنده طلب سحب مفتوح.";
    const [live] = await tx
      .select({ id: lecturesTable.id })
      .from(lecturesTable)
      .innerJoin(bookingsTable, eq(bookingsTable.lectureId, lecturesTable.id))
      .where(and(eq(lecturesTable.teacherId, user.id), open, eq(bookingsTable.status, "confirmed"), sql`${bookingsTable.pricePaidCents} > 0`))
      .limit(1);
    if (live) return "عنده حصة جاية فيها حجوزات مدفوعة. الغيها الأول عشان الطلاب ياخدوا فلوسهم.";
    const [running] = await tx.select({ id: lecturesTable.id }).from(lecturesTable).where(and(eq(lecturesTable.teacherId, user.id), eq(lecturesTable.status, "live"))).limit(1);
    if (running) return "عنده حصة شغالة دلوقتي.";
  }
  if (user.role === "student") {
    const [paid] = await tx
      .select({ id: bookingsTable.id })
      .from(bookingsTable)
      .innerJoin(lecturesTable, eq(lecturesTable.id, bookingsTable.lectureId))
      .where(and(eq(bookingsTable.studentId, user.id), open, eq(bookingsTable.status, "confirmed"), sql`${bookingsTable.pricePaidCents} > 0`))
      .limit(1);
    if (paid) return "عنده حجز مدفوع في حصة لسه متعملتش.";
    const [report] = await tx.select({ id: lectureReportsTable.id }).from(lectureReportsTable).where(and(eq(lectureReportsTable.studentId, user.id), eq(lectureReportsTable.status, "open"))).limit(1);
    if (report) return "عنده بلاغ مفتوح على حصة.";
  }
  return null;
}

/** Postgres refused because another row still points at this one. */
function isForeignKeyError(err: unknown) {
  for (let e = err as { code?: string; cause?: unknown } | undefined; e; e = e.cause as typeof e) if (e.code === "23503") return true;
  return false;
}

export async function removeUser(id: string, actor: User): Promise<RemovalResult> {
  const lockedOut = await hashPassword(randomToken());
  const files: string[] = [];
  let cancelled: Lecture[] = [];
  const result = await db.transaction(async (tx): Promise<RemovalResult> => {
    const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, id)).for("update");
    if (!user || user.deletedAt) return { outcome: "skipped", reason: "الحساب مش موجود." };
    const stopped = await blocker(tx, user, actor);
    if (stopped) return { outcome: "skipped", reason: stopped };

    // The identity documents go in every case.
    const documents = await tx.select({ key: verificationDocumentsTable.storageKey }).from(verificationDocumentsTable).where(eq(verificationDocumentsTable.ownerId, id));
    await tx.delete(teacherVerificationsTable).where(eq(teacherVerificationsTable.teacherId, id));
    await tx.delete(verificationReviewsTable).where(eq(verificationReviewsTable.teacherId, id));
    await tx.delete(verificationDocumentsTable).where(eq(verificationDocumentsTable.ownerId, id));
    files.push(...documents.map((d) => d.key));

    try {
      const uploads = await tx.transaction(async (attempt) => {
        // Classes nobody ever booked and that hold no money are gone with their teacher.
        await attempt.delete(lecturesTable).where(and(eq(lecturesTable.teacherId, id), notExists(tx.select({ id: bookingsTable.id }).from(bookingsTable).where(eq(bookingsTable.lectureId, lecturesTable.id))), notExists(tx.select({ id: walletEntriesTable.id }).from(walletEntriesTable).where(eq(walletEntriesTable.lectureId, lecturesTable.id)))));
        const removed = await attempt.delete(uploadsTable).where(eq(uploadsTable.ownerId, id)).returning({ key: uploadsTable.storageKey });
        await attempt.delete(usersTable).where(eq(usersTable.id, id));
        return removed;
      });
      files.push(...uploads.map((u) => u.key));
      await recordAdminAction(tx, actor.id, "user.delete", id, user.role);
      return { outcome: "deleted" };
    } catch (err) {
      if (!isForeignKeyError(err)) throw err;
    }

    await tx.delete(sessionsTable).where(eq(sessionsTable.userId, id));
    await tx.delete(passwordResetsTable).where(eq(passwordResetsTable.userId, id));
    await tx.delete(securityChallengesTable).where(eq(securityChallengesTable.userId, id));
    await tx.delete(userSecurityTable).where(eq(userSecurityTable.userId, id));
    await tx.delete(notificationsTable).where(eq(notificationsTable.userId, id));
    await tx.delete(parentLinksTable).where(or(eq(parentLinksTable.parentId, id), eq(parentLinksTable.studentId, id)));
    await tx.delete(teacherFollowsTable).where(or(eq(teacherFollowsTable.studentId, id), eq(teacherFollowsTable.teacherId, id)));
    await tx.delete(savedLecturesTable).where(eq(savedLecturesTable.studentId, id));
    await tx.delete(teacherProfilesTable).where(eq(teacherProfilesTable.userId, id));
    await tx.delete(studentProfilesTable).where(eq(studentProfilesTable.userId, id));
    // Seats in classes still to come are released; past attendance stays as history.
    const upcoming = tx.select({ id: lecturesTable.id }).from(lecturesTable).where(inArray(lecturesTable.status, ["draft", "scheduled"]));
    await tx.update(bookingsTable).set({ status: "cancelled" }).where(and(eq(bookingsTable.studentId, id), inArray(bookingsTable.status, ["pending_payment", "confirmed"]), inArray(bookingsTable.lectureId, upcoming)));
    await tx.update(lecturesTable).set({ listed: false, updatedAt: new Date() }).where(eq(lecturesTable.teacherId, id));
    cancelled = await tx.update(lecturesTable).set({ status: "cancelled", updatedAt: new Date() }).where(and(eq(lecturesTable.teacherId, id), inArray(lecturesTable.status, ["draft", "scheduled"]))).returning();
    await tx
      .update(usersTable)
      .set({ name: "حساب محذوف", email: `deleted-${id}@deleted.invalid`, phone: null, avatarUrl: null, passwordHash: lockedOut, suspended: true, deletedAt: new Date() })
      .where(eq(usersTable.id, id));
    await recordAdminAction(tx, actor.id, "user.erase", id, user.role);
    return { outcome: "erased" };
  });

  // Students of a removed teacher's free classes still hear the class is off.
  for (const lecture of cancelled) await settleCancelledLecture(lecture).catch((err: unknown) => logger.error({ err, lectureId: lecture.id }, "could not announce a removed teacher's class"));
  for (const key of result.outcome === "skipped" ? [] : files) await unlink(path.join(env.uploadDir, key)).catch((err: unknown) => logger.warn({ err }, "could not remove a removed account's file"));
  return result;
}
