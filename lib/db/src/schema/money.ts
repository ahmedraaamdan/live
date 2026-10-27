import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { bookingsTable, lecturesTable } from "./lectures";
import { usersTable } from "./users";

export const paymentStatusEnum = pgEnum("payment_status", ["pending", "succeeded", "failed", "refunded"]);

export const paymentsTable = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookingsTable.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id),
    /** mock | paymob */
    provider: text("provider").notNull(),
    /** The gateway's id for the checkout (Paymob intention id). */
    providerRef: text("provider_ref"),
    /** The gateway's transaction id, once paid (needed for refunds). */
    providerTxnId: text("provider_txn_id"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("EGP"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    method: text("method"),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_booking_idx").on(t.bookingId), index("payments_user_idx").on(t.userId)],
);

export const walletOwnerEnum = pgEnum("wallet_owner", ["teacher", "platform"]);
export const walletEntryKindEnum = pgEnum("wallet_entry_kind", ["sale", "commission", "payout", "refund", "adjustment"]);
export const walletEntryStatusEnum = pgEnum("wallet_entry_status", ["pending", "available", "void"]);

/**
 * Append-only ledger. A paid booking writes two rows: the teacher's share
 * (kind sale) and the platform's (kind commission), both pending until the
 * lecture has happened. Balances are sums over this table, never a stored
 * number.
 */
export const walletEntriesTable = pgTable(
  "wallet_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    owner: walletOwnerEnum("owner").notNull(),
    teacherId: uuid("teacher_id").references(() => usersTable.id),
    kind: walletEntryKindEnum("kind").notNull(),
    /** Signed: credits positive, payouts and refunds negative. */
    amountCents: integer("amount_cents").notNull(),
    status: walletEntryStatusEnum("status").notNull().default("pending"),
    lectureId: uuid("lecture_id").references(() => lecturesTable.id),
    bookingId: uuid("booking_id").references(() => bookingsTable.id),
    paymentId: uuid("payment_id").references(() => paymentsTable.id),
    payoutId: uuid("payout_id"),
    memo: text("memo").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("wallet_entries_teacher_idx").on(t.teacherId, t.createdAt), index("wallet_entries_lecture_idx").on(t.lectureId)],
);

export const payoutStatusEnum = pgEnum("payout_status", ["requested", "paid", "rejected"]);

export const payoutsTable = pgTable(
  "payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => usersTable.id),
    amountCents: integer("amount_cents").notNull(),
    method: text("method").notNull(),
    account: text("account").notNull(),
    status: payoutStatusEnum("status").notNull().default("requested"),
    adminNote: text("admin_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [index("payouts_teacher_idx").on(t.teacherId)],
);

export type Payment = typeof paymentsTable.$inferSelect;
export type WalletEntry = typeof walletEntriesTable.$inferSelect;
export type Payout = typeof payoutsTable.$inferSelect;
