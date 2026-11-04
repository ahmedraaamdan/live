CREATE TABLE "lecture_mail_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"lecture_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"recipient_ids" jsonb NOT NULL,
	"subject" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"processed" integer DEFAULT 0 NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lecture_mail_jobs" ADD CONSTRAINT "lecture_mail_jobs_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lecture_mail_jobs" ADD CONSTRAINT "lecture_mail_jobs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lecture_mail_jobs_pending_idx" ON "lecture_mail_jobs" USING btree ("completed_at","created_at");