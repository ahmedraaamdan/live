CREATE TABLE "saved_lectures" (
	"student_id" uuid NOT NULL,
	"lecture_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_lectures_student_id_lecture_id_pk" PRIMARY KEY("student_id","lecture_id")
);
--> statement-breakpoint
CREATE TABLE "teacher_follows" (
	"student_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_follows_student_id_teacher_id_pk" PRIMARY KEY("student_id","teacher_id")
);
--> statement-breakpoint
ALTER TABLE "saved_lectures" ADD CONSTRAINT "saved_lectures_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_lectures" ADD CONSTRAINT "saved_lectures_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_follows" ADD CONSTRAINT "teacher_follows_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_follows" ADD CONSTRAINT "teacher_follows_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "teacher_follows_teacher_idx" ON "teacher_follows" USING btree ("teacher_id");