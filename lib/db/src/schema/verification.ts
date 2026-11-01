import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
export const userSecurityTable = pgTable("user_security", {
  userId: uuid("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  googleSubject: text("google_subject").unique(), googleEmail: text("google_email"),
  facebookSubject: text("facebook_subject").unique(), facebookName: text("facebook_name"), facebookEmail: text("facebook_email"),
  totpSecretEnc: text("totp_secret_enc"), totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
  pendingTotpSecretEnc: text("pending_totp_secret_enc"), pendingTotpExpiresAt: timestamp("pending_totp_expires_at", { withTimezone: true }),
  lastTotpStep: integer("last_totp_step").notNull().default(-1),
  recoveryHashes: jsonb("recovery_hashes").$type<string[]>().notNull().default([]),
  mfaFailures: integer("mfa_failures").notNull().default(0), mfaLockedUntil: timestamp("mfa_locked_until", { withTimezone: true }),
});
/** One-use login and social-binding challenges. Raw tokens never enter the database. */
export const securityChallengesTable = pgTable("security_challenges", {
  tokenHash: text("token_hash").primaryKey(), userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  purpose: text("purpose").notNull(), sessionHash: text("session_hash"), payloadEnc: text("payload_enc"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("security_challenges_user_idx").on(t.userId), index("security_challenges_expiry_idx").on(t.expiresAt)]);
/** Kept separate from capability-URL homework uploads: these documents always require authentication. */
export const verificationDocumentsTable = pgTable("verification_documents", {
  id: uuid("id").primaryKey().defaultRandom(), ownerId: uuid("owner_id").notNull().references(() => usersTable.id),
  filename: text("filename").notNull(), mime: text("mime").notNull(), size: integer("size").notNull(), storageKey: text("storage_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("verification_documents_owner_idx").on(t.ownerId)]);
export const teacherVerificationsTable = pgTable("teacher_verifications", {
  teacherId: uuid("teacher_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  status: text("status").$type<"pending" | "approved" | "rejected" | "needs_changes">().notNull(),
  fullName: text("full_name").notNull(), phone: text("phone").notNull(), subject: text("subject").notNull(), governorate: text("governorate").notNull(),
  qualification: text("qualification").notNull(), experienceYears: integer("experience_years").notNull(), membershipNumber: text("membership_number").notNull(),
  documentType: text("document_type").$type<"national_id" | "syndicate_card">().notNull().default("syndicate_card"), pageUrl: text("page_url").notNull().default(""),
  frontDocumentId: uuid("front_document_id").notNull().references(() => verificationDocumentsTable.id), backDocumentId: uuid("back_document_id").notNull().references(() => verificationDocumentsTable.id),
  note: text("note").notNull().default(""), submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }), reviewerId: uuid("reviewer_id").references(() => usersTable.id),
}, t => [index("teacher_verifications_queue_idx").on(t.status, t.submittedAt)]);
export const verificationReviewsTable = pgTable("verification_reviews", {
  id: uuid("id").primaryKey().defaultRandom(), teacherId: uuid("teacher_id").notNull().references(() => usersTable.id),
  actorId: uuid("actor_id").notNull().references(() => usersTable.id), action: text("action").notNull(), note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("verification_reviews_teacher_idx").on(t.teacherId, t.createdAt)]);
