import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { lecturesTable } from "./lectures";
import { usersTable } from "./users";

export const assignmentsTable = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lecturesTable.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => usersTable.id),
    title: text("title").notNull(),
    instructions: text("instructions").notNull().default(""),
    questions: jsonb("questions").$type<Array<{ id: string; prompt: string; options: string[]; correctIndex: number; points: number }>>().notNull().default([]),
    dueAt: timestamp("due_at", { withTimezone: true }),
    maxScore: integer("max_score").notNull().default(10),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assignments_lecture_idx").on(t.lectureId), index("assignments_teacher_idx").on(t.teacherId)],
);

export const submissionsTable = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignmentsTable.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => usersTable.id),
    body: text("body").notNull().default(""),
    answers: jsonb("answers").$type<Record<string, number>>().notNull().default({}),
    gradingMethod: text("grading_method").$type<"manual" | "automatic">().notNull().default("manual"),
    attachmentIds: jsonb("attachment_ids").$type<string[]>().notNull().default([]),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    score: integer("score"),
    feedback: text("feedback"),
    gradedAt: timestamp("graded_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("submissions_assignment_student_idx").on(t.assignmentId, t.studentId)],
);

export const uploadsTable = pgTable("uploads", {
  /** Random UUID; doubles as the capability in the file's URL. */
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => usersTable.id),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  /** Key in the storage backend (a path under UPLOAD_DIR for now). */
  storageKey: text("storage_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Assignment = typeof assignmentsTable.$inferSelect;
export type Submission = typeof submissionsTable.$inferSelect;
export type Upload = typeof uploadsTable.$inferSelect;

/** Private reusable homework library; answer keys are teacher-owned. */
export const homeworkTemplatesTable = pgTable("homework_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  teacherId: uuid("teacher_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  instructions: text("instructions").notNull().default(""),
  questions: jsonb("questions").$type<Array<{ id: string; prompt: string; options: string[]; correctIndex: number; points: number }>>().notNull().default([]),
  maxScore: integer("max_score").notNull().default(10),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("homework_templates_teacher_idx").on(t.teacherId, t.updatedAt)]);
