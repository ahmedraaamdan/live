CREATE TABLE "lecture_reminder_deliveries" (
	"lecture_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"retry_after" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "lecture_reminder_deliveries_lecture_id_user_id_starts_at_pk" PRIMARY KEY("lecture_id","user_id","starts_at")
);
--> statement-breakpoint
ALTER TABLE "lecture_reminder_deliveries" ADD CONSTRAINT "lecture_reminder_deliveries_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lecture_reminder_deliveries" ADD CONSTRAINT "lecture_reminder_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;