ALTER TABLE "assignments" ADD COLUMN "questions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "answers" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "grading_method" text DEFAULT 'manual' NOT NULL;