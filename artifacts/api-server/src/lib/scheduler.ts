/**
 * Once a minute: reminders an hour before class, releasing teachers' money
 * after the hold, freeing seats held by abandoned checkouts, and ending
 * lectures a teacher forgot to end.
 *
 * Each job is a single idempotent query plus side effects, so a missed or
 * doubled tick is harmless. With more than one API process, run it in one
 * (SCHEDULER=off on the others).
 */
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { bookingsTable, db, lecturesTable, paymentsTable, usersTable } from "@workspace/db";
import { bookedStudentIds } from "./access";
import { sendLectureReminder } from "./emails";
import { env } from "./env";
import { releaseLectureFunds } from "./ledger";
import { logger } from "./logger";
import { notify } from "./notify";
import { endLecture } from "../routes/live";
import { PENDING_HOLD_MIN } from "../routes/lectures";

async function sendReminders() {
  const due = await db
    .update(lecturesTable)
    .set({ reminderSentAt: new Date() })
    .where(
      and(
        eq(lecturesTable.status, "scheduled"),
        isNull(lecturesTable.reminderSentAt),
        sql`${lecturesTable.startsAt} between now() and now() + interval '60 minutes'`,
      ),
    )
    .returning();
  for (const lecture of due) {
    const ids = await bookedStudentIds(lecture.id);
    if (!ids.length) continue;
    const teacher = await db.query.usersTable.findFirst({ where: eq(usersTable.id, lecture.teacherId) });
    const students = await db.select().from(usersTable).where(inArray(usersTable.id, ids));
    await notify(ids, { kind: "reminder", title: "حصتك كمان ساعة ⏰", body: lecture.title, link: `/lectures/${lecture.id}` });
    for (const s of students) void sendLectureReminder(s, lecture, teacher?.name ?? "");
  }
}

async function releaseFunds() {
  const ready = await db
    .update(lecturesTable)
    .set({ fundsReleasedAt: new Date() })
    .where(
      and(
        eq(lecturesTable.status, "ended"),
        isNull(lecturesTable.fundsReleasedAt),
        sql`${lecturesTable.liveEndedAt} < now() - make_interval(hours => ${env.payoutHoldHours})`,
      ),
    )
    .returning();
  for (const l of ready) {
    await releaseLectureFunds(l.id);
    await notify([l.teacherId], { kind: "funds", title: "فلوس حصة بقت متاحة للسحب 💰", body: l.title, link: "/t/wallet" });
  }
}

async function expireCheckouts() {
  const cutoff = new Date(Date.now() - PENDING_HOLD_MIN * 60_000);
  const stale = await db
    .update(paymentsTable)
    .set({ status: "failed", updatedAt: new Date() })
    .where(and(eq(paymentsTable.status, "pending"), lt(paymentsTable.createdAt, cutoff)))
    .returning({ bookingId: paymentsTable.bookingId });
  if (stale.length) {
    await db
      .update(bookingsTable)
      .set({ status: "cancelled" })
      .where(and(inArray(bookingsTable.id, stale.map((s) => s.bookingId)), eq(bookingsTable.status, "pending_payment")));
  }
}

async function endForgottenLectures() {
  const stuck = await db
    .select({ id: lecturesTable.id })
    .from(lecturesTable)
    .where(and(eq(lecturesTable.status, "live"), sql`${lecturesTable.startsAt} + make_interval(mins => ${lecturesTable.durationMin} + 120) < now()`));
  for (const l of stuck) await endLecture(l.id);
}

export function startScheduler() {
  if (process.env.SCHEDULER === "off") return;
  const tick = async () => {
    for (const job of [sendReminders, releaseFunds, expireCheckouts, endForgottenLectures]) {
      try {
        await job();
      } catch (err) {
        logger.error({ err, job: job.name }, "Scheduler job failed");
      }
    }
  };
  setTimeout(tick, 5_000);
  setInterval(tick, 60_000);
}
