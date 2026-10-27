CREATE TABLE "lecture_votes" (
	"lecture_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lecture_votes_lecture_id_student_id_pk" PRIMARY KEY("lecture_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "lectures" ADD COLUMN "listed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "lecture_votes" ADD CONSTRAINT "lecture_votes_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lecture_votes" ADD CONSTRAINT "lecture_votes_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lecture_votes_lecture_idx" ON "lecture_votes" USING btree ("lecture_id");