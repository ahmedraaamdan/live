import { reconcileEasykashPending } from "./easykash-reconcile";
/**
 * Once a minute: reminders an hour before class, cancelling classes nobody
 * started, settling teachers' money after the hold, freeing seats held by
 * abandoned checkouts, and ending lectures a teacher forgot to end.
 *
 * Each job picks its work with one query and settles each item on its own, so a
 * missed or doubled tick is harmless. With more than one API process, run it in
 * one (SCHEDULER=off on the others).
 */
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { bookingsTable, db, lecturesTable, paymentsTable, usersTable } from "@workspace/db";
import { NO_SHOW_GRACE_MINUTES } from "@workspace/live-core";
import { bookedStudentIds } from "./access";
import { settleCancelledLecture } from "./bookings";
import { sendLectureReminder } from "./emails";
import { env } from "./env";
import { settleLectureFunds } from "./funds";
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

/** A class its teacher never started: students get their money back instead of waiting. */
export async function cancelNoShows() {
  const missed = await db
    .update(lecturesTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(lecturesTable.status, "scheduled"), sql`${lecturesTable.startsAt} + make_interval(mins => ${NO_SHOW_GRACE_MINUTES}) < now()`))
    .returning();
  for (const lecture of missed) {
    try {
      await settleCancelledLecture(lecture, { noShow: true });
    } catch (err) {
      logger.error({ err, lectureId: lecture.id }, "Could not settle a cancelled lecture");
    }
  }
  // A crash between marking and refunding must not leave anyone with a seat in a dead class.
  const stranded = await db
    .selectDistinct({ lecture: lecturesTable })
    .from(lecturesTable)
    .innerJoin(bookingsTable, eq(bookingsTable.lectureId, lecturesTable.id))
    .where(and(eq(lecturesTable.status, "cancelled"), inArray(bookingsTable.status, ["confirmed", "pending_payment"]), sql`${lecturesTable.updatedAt} < now() - interval '5 minutes'`));
  for (const { lecture } of stranded) await settleCancelledLecture(lecture);
}

export async function releaseFunds() {
  const ready = await db
    .select({ id: lecturesTable.id })
    .from(lecturesTable)
    .where(
      and(
        eq(lecturesTable.status, "ended"),
        isNull(lecturesTable.fundsReleasedAt),
        isNull(lecturesTable.fundsReviewedAt),
        isNull(lecturesTable.fundsReviewReason),
        sql`${lecturesTable.liveEndedAt} < now() - make_interval(hours => ${env.payoutHoldHours})`,
      ),
    );
  for (const { id } of ready) {
    try {
      await settleLectureFunds(id);
    } catch (err) {
      logger.error({ err, lectureId: id }, "Could not settle a lecture's earnings");
    }
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
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
    for (const job of [reconcileEasykashPending, sendReminders, cancelNoShows, releaseFunds, expireCheckouts, endForgottenLectures]) {
      try {
        await job();
      } catch (err) {
        logger.error({ err, job: job.name }, "Scheduler job failed");
      }
    }
    } finally { running = false; }
  };
  setTimeout(tick, 5_000);
  setInterval(tick, 60_000);
}
