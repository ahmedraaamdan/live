ALTER TABLE "lecture_reminder_deliveries" DROP CONSTRAINT "lecture_reminder_deliveries_lecture_id_user_id_starts_at_pk";--> statement-breakpoint
ALTER TABLE "lecture_reminder_deliveries" ADD COLUMN "stage" text DEFAULT '15m' NOT NULL;--> statement-breakpoint
ALTER TABLE "lecture_reminder_deliveries" ADD CONSTRAINT "lecture_reminder_deliveries_lecture_id_user_id_starts_at_stage_pk" PRIMARY KEY("lecture_id","user_id","starts_at","stage");
