ALTER TABLE "student_profiles" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "curriculum" text;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "track" text;--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD COLUMN "curriculum" text;--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD COLUMN "track" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "lectures" ADD COLUMN "curriculum" text DEFAULT 'egypt_general' NOT NULL;--> statement-breakpoint
ALTER TABLE "lectures" ADD COLUMN "track" text;--> statement-breakpoint
ALTER TABLE "lectures" ADD COLUMN "currency" text DEFAULT 'EGP' NOT NULL;