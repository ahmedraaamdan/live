CREATE TABLE "account_switches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "actor_token_hash" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "switch_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_switch_id_account_switches_id_fk" FOREIGN KEY ("switch_id") REFERENCES "public"."account_switches"("id") ON DELETE no action ON UPDATE no action;