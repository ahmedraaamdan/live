CREATE TABLE "homework_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"title" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_score" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD COLUMN "experience" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD COLUMN "social_links" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD COLUMN "certificates" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "lectures" ADD COLUMN "cover_url" text;--> statement-breakpoint
ALTER TABLE "homework_templates" ADD CONSTRAINT "homework_templates_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "homework_templates_teacher_idx" ON "homework_templates" USING btree ("teacher_id","updated_at");