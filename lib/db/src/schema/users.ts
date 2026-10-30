import { boolean, index, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["student", "teacher", "parent", "admin"]);

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: roleEnum("role").notNull(),
  name: text("name").notNull(),
  /** Always stored lower-cased. */
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  suspended: boolean("suspended").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Durable support-access audit; IDs are retained even if an account is removed. */
export const accountSwitchesTable = pgTable("account_switches", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").notNull(),
  targetId: uuid("target_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

/** Opaque bearer tokens; only the SHA-256 of a token is stored. */
export const sessionsTable = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    actorTokenHash: text("actor_token_hash"),
    switchId: uuid("switch_id").references(() => accountSwitchesTable.id),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResetsTable = pgTable("password_resets", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export const teacherProfilesTable = pgTable("teacher_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  headline: text("headline").notNull().default(""),
  bio: text("bio").notNull().default(""),
  subject: text("subject"),
  experience: text("experience").notNull().default(""),
  socialLinks: jsonb("social_links").$type<Array<{ label: string; url: string; kind?: "image" | "document" | "link" }>>().notNull().default([]),
  certificates: jsonb("certificates").$type<Array<{ label: string; url: string; kind?: "image" | "document" | "link" }>>().notNull().default([]),
});

export const studentProfilesTable = pgTable("student_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  grade: text("grade"),
  /** Where booking emails go even before the parent has an account. */
  parentEmail: text("parent_email"),
  /** Short code a parent types to link to this student. */
  linkCode: text("link_code").notNull().unique(),
});

export const parentLinksTable = pgTable(
  "parent_links",
  {
    parentId: uuid("parent_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.parentId, t.studentId] }), index("parent_links_student_idx").on(t.studentId)],
);

export const notificationsTable = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export type User = typeof usersTable.$inferSelect;
export type TeacherProfile = typeof teacherProfilesTable.$inferSelect;
export type StudentProfile = typeof studentProfilesTable.$inferSelect;
