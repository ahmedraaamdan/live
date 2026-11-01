ALTER TABLE "users" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "teacher_verifications" ADD COLUMN "document_type" text DEFAULT 'syndicate_card' NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_verifications" ADD COLUMN "page_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "users" SET "last_seen_at" = latest."at" FROM (SELECT "user_id", max("created_at") AS "at" FROM "sessions" WHERE "actor_token_hash" IS NULL GROUP BY "user_id") AS latest WHERE "users"."id" = latest."user_id";
