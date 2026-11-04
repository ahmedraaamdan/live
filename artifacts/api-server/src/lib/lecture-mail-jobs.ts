import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { bookingsTable, db, lectureMailJobsTable as jobs, lecturesTable, usersTable } from "@workspace/db";
import { renderLectureMail } from "./emails";
import { deliverLectureMail } from "./lecture-reminders";
import { logger } from "./logger";
import { sendMail } from "./mailer";

const available = and(isNull(jobs.completedAt), or(isNull(jobs.leaseUntil), lt(jobs.leaseUntil, sql`now()`)));
let running = false;

export async function processLectureMailJobs() {
  if (running) return;
  running = true;
  try {
    while (true) {
      const next = await db.query.lectureMailJobsTable.findFirst({ where: available, orderBy: [asc(jobs.createdAt)] });
      if (!next) break;

      const leaseUntil = new Date(Date.now() + 120_000);
      const [job] = await db.update(jobs).set({ leaseUntil }).where(and(eq(jobs.id, next.id), available)).returning();
      if (!job) continue;

      const lecture = await db.query.lecturesTable.findFirst({ where: eq(lecturesTable.id, job.lectureId) });
      if (!lecture) continue;
      const ids = job.recipientIds.slice(job.processed, job.processed + 8);
      const [teacher, students] = await Promise.all([
        db.query.usersTable.findFirst({ where: eq(usersTable.id, lecture.teacherId) }),
        db.select({ user: usersTable }).from(bookingsTable).innerJoin(usersTable, eq(usersTable.id, bookingsTable.studentId))
          .where(and(eq(bookingsTable.lectureId, lecture.id), eq(bookingsTable.status, "confirmed"), inArray(usersTable.id, ids), eq(usersTable.suspended, false))),
      ]);
      const recipients = students.map(({ user }) => user);
      if (teacher && !teacher.suspended && ids.includes(teacher.id)) recipients.push(teacher);
      const mail = renderLectureMail(lecture, teacher?.name ?? "", job);
      const sent = await deliverLectureMail(recipients, (user) => sendMail({ to: user.email, subject: job.subject, ...mail }));
      const processed = job.processed + ids.length;
      const completedAt = processed === job.recipientIds.length ? new Date() : null;
      await db.update(jobs).set({ processed, sent: job.sent + sent, leaseUntil: null, completedAt })
        .where(and(eq(jobs.id, job.id), eq(jobs.leaseUntil, leaseUntil)));
    }
  } catch (err) {
    logger.error({ err }, "Lecture email queue failed");
  } finally {
    running = false;
  }
}
