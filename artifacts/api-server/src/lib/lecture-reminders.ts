import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { bookingsTable, db, lectureReminderDeliveriesTable as deliveries, lecturesTable, usersTable, type Lecture } from "@workspace/db";
import { sendLectureReminder } from "./emails";
import { logger } from "./logger";

export async function lectureMailRecipients(lecture: Lecture, includeStudents: boolean) {
  const teacherQuery = db.query.usersTable.findFirst({ where: eq(usersTable.id, lecture.teacherId) });
  const studentsQuery = includeStudents
    ? db.select({ user: usersTable }).from(bookingsTable)
        .innerJoin(usersTable, eq(usersTable.id, bookingsTable.studentId))
        .where(and(eq(bookingsTable.lectureId, lecture.id), eq(bookingsTable.status, "confirmed"), eq(usersTable.suspended, false)))
    : [];
  const [teacher, students] = await Promise.all([teacherQuery, studentsQuery]);
  return { teacher, students: students.map(({ user }) => user) };
}

/** Bound concurrent SMTP connections for each class. */
export async function deliverLectureMail<T>(recipients: T[], send: (recipient: T) => Promise<boolean>) {
  let sent = 0;
  for (let i = 0; i < recipients.length; i += 8) {
    const outcomes = await Promise.allSettled(recipients.slice(i, i + 8).map(send));
    for (const outcome of outcomes) {
      if (outcome.status === "fulfilled" && outcome.value) sent++;
      if (outcome.status === "rejected") logger.error({ err: outcome.reason }, "Lecture mail delivery failed");
    }
  }
  return sent;
}

export async function sendDueLectureReminders() {
  const due = await db.select().from(lecturesTable).where(and(
    eq(lecturesTable.status, "scheduled"),
    sql`${lecturesTable.startsAt} > now() and ${lecturesTable.startsAt} <= now() + interval '10 minutes'`,
  )).orderBy(lecturesTable.startsAt);

  for (const lecture of due) {
    const { teacher, students } = await lectureMailRecipients(lecture, true);
    if (!teacher || teacher.suspended) continue;
    const existing = await db.select().from(deliveries).where(and(
      eq(deliveries.lectureId, lecture.id), eq(deliveries.startsAt, lecture.startsAt),
    ));
    const now = new Date();
    const skip = new Set(existing.filter((row) => row.sentAt || row.retryAfter >= now).map((row) => row.userId));
    await deliverLectureMail([teacher, ...students].filter((user) => !skip.has(user.id)), async (user) => {
      const active = await db.query.lecturesTable.findFirst({ where: and(
        eq(lecturesTable.id, lecture.id), eq(lecturesTable.status, "scheduled"),
        eq(lecturesTable.startsAt, lecture.startsAt), sql`${lecturesTable.startsAt} > now()`,
      ) });
      if (!active) return false;
      if (user.id !== teacher.id) {
        const booking = await db.query.bookingsTable.findFirst({ where: and(
          eq(bookingsTable.lectureId, lecture.id), eq(bookingsTable.studentId, user.id), eq(bookingsTable.status, "confirmed"),
        ) });
        if (!booking) return false;
      }
      const retryAfter = new Date(Date.now() + 120_000);
      const key = { lectureId: lecture.id, userId: user.id, startsAt: lecture.startsAt };
      const claimed = await db.insert(deliveries).values({ ...key, retryAfter }).onConflictDoUpdate({
        target: [deliveries.lectureId, deliveries.userId, deliveries.startsAt],
        set: { retryAfter },
        setWhere: and(isNull(deliveries.sentAt), lt(deliveries.retryAfter, sql`now()`)),
      }).returning({ userId: deliveries.userId });
      if (!claimed.length || !await sendLectureReminder(user, active, teacher.name)) return false;
      await db.update(deliveries).set({ sentAt: new Date() }).where(and(
        eq(deliveries.lectureId, key.lectureId), eq(deliveries.userId, key.userId), eq(deliveries.startsAt, key.startsAt),
      ));
      return true;
    });
  }
}
