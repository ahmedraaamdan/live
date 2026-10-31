import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const lectureStatusEnum = pgEnum("lecture_status", ["draft", "scheduled", "live", "ended", "cancelled"]);

export const lecturesTable = pgTable(
  "lectures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => usersTable.id),
    /** Short share code in the booking link: /l/<code>. */
    code: text("code").notNull().unique(),
    title: text("title").notNull(),
    subject: text("subject").notNull(),
    grade: text("grade").notNull(),
    description: text("description").notNull().default(""),
    coverUrl: text("cover_url"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    durationMin: integer("duration_min").notNull(),
    priceCents: integer("price_cents").notNull(),
    capacity: integer("capacity"),
    /** Shown in the students' discovery feed (otherwise reachable by link only). */
    listed: boolean("listed").notNull().default(true),
    status: lectureStatusEnum("status").notNull().default("scheduled"),
    liveStartedAt: timestamp("live_started_at", { withTimezone: true }),
    liveEndedAt: timestamp("live_ended_at", { withTimezone: true }),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    /** When the teacher's earnings for this lecture became withdrawable. */
    fundsReleasedAt: timestamp("funds_released_at", { withTimezone: true }),
    /** Why the teacher's earnings wait for an administrator; cleared or decided by them. */
    fundsReviewReason: text("funds_review_reason").$type<"short_live" | "no_attendance" | "reported">(),
    fundsReviewedAt: timestamp("funds_reviewed_at", { withTimezone: true }),
    fundsReviewedBy: uuid("funds_reviewed_by").references(() => usersTable.id),
    /** Last time the start moved with students booked; they may then still leave. */
    rescheduledAt: timestamp("rescheduled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lectures_teacher_idx").on(t.teacherId, t.startsAt), index("lectures_status_idx").on(t.status, t.startsAt)],
);

/** A student's report that a finished class went wrong. Holds its earnings until decided. */
export const lectureReportsTable = pgTable(
  "lecture_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lecturesTable.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => usersTable.id),
    reason: text("reason").$type<"not_held" | "ended_early" | "technical" | "other">().notNull(),
    details: text("details").notNull().default(""),
    status: text("status").$type<"open" | "dismissed" | "refunded">().notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => usersTable.id),
  },
  (t) => [uniqueIndex("lecture_reports_lecture_student_idx").on(t.lectureId, t.studentId), index("lecture_reports_status_idx").on(t.status)],
);

/** A student following a teacher: that teacher's classes come first in their feed. */
export const teacherFollowsTable = pgTable(
  "teacher_follows",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.teacherId] }), index("teacher_follows_teacher_idx").on(t.teacherId)],
);

/** A class a student kept for later, to come back and book it. */
export const savedLecturesTable = pgTable(
  "saved_lectures",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lecturesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.lectureId] })],
);

export const bookingStatusEnum = pgEnum("booking_status", ["pending_payment", "confirmed", "cancelled", "refunded"]);

export const bookingsTable = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lecturesTable.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => usersTable.id),
    status: bookingStatusEnum("status").notNull().default("pending_payment"),
    pricePaidCents: integer("price_paid_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    /** Identifies the payment that granted this seat, so refunding a duplicate cannot revoke it. */
    confirmedPaymentId: uuid("confirmed_payment_id"),
  },
  (t) => [uniqueIndex("bookings_lecture_student_idx").on(t.lectureId, t.studentId), index("bookings_student_idx").on(t.studentId)],
);

export const messageKindEnum = pgEnum("message_kind", ["question", "comment", "answer"]);

/** The live comments / Q&A stream of a lecture. */
export const lectureMessagesTable = pgTable(
  "lecture_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lecturesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id),
    kind: messageKindEnum("kind").notNull().default("question"),
    body: text("body").notNull(),
    /** For an answer: the question it answers. */
    parentId: uuid("parent_id"),
    answered: boolean("answered").notNull().default(false),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lecture_messages_lecture_idx").on(t.lectureId, t.createdAt)],
);

/** Seconds each student spent in a lecture, from the app's heartbeats. */
export const attendanceTable = pgTable(
  "attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lecturesTable.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => usersTable.id),
    liveSeconds: integer("live_seconds").notNull().default(0),
    replaySeconds: integer("replay_seconds").notNull().default(0),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("attendance_lecture_student_idx").on(t.lectureId, t.studentId)],
);

export const recordingStatusEnum = pgEnum("recording_status", ["recording", "processing", "ready", "failed"]);

export const recordingsTable = pgTable(
  "recordings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lecturesTable.id, { onDelete: "cascade" }),
    /** livekit (egress) or manual (a link the teacher pasted). */
    provider: text("provider").notNull(),
    egressId: text("egress_id"),
    status: recordingStatusEnum("status").notNull().default("recording"),
    url: text("url"),
    durationSec: integer("duration_sec"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readyAt: timestamp("ready_at", { withTimezone: true }),
  },
  (t) => [index("recordings_lecture_idx").on(t.lectureId)],
);

/** Likes (+1) and dislikes (-1). Only students who actually watched can vote. */
export const lectureVotesTable = pgTable(
  "lecture_votes",
  {
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lecturesTable.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => usersTable.id),
    value: integer("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.lectureId, t.studentId] }), index("lecture_votes_lecture_idx").on(t.lectureId)],
);

/** Whiteboard ops in order (see BoardOp in @workspace/live-core). Replayed to rebuild the board. */
export const boardOpsTable = pgTable(
  "board_ops",
  {
    seq: bigserial("seq", { mode: "number" }).primaryKey(),
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lecturesTable.id, { onDelete: "cascade" }),
    op: jsonb("op").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("board_ops_lecture_idx").on(t.lectureId, t.seq)],
);

export type Lecture = typeof lecturesTable.$inferSelect;
export type Booking = typeof bookingsTable.$inferSelect;
export type LectureMessage = typeof lectureMessagesTable.$inferSelect;
export type Recording = typeof recordingsTable.$inferSelect;
