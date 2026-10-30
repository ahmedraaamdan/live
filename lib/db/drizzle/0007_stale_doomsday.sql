CREATE TABLE "security_challenges" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"session_hash" text,
	"payload_enc" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_verifications" (
	"teacher_id" uuid PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"subject" text NOT NULL,
	"governorate" text NOT NULL,
	"qualification" text NOT NULL,
	"experience_years" integer NOT NULL,
	"membership_number" text NOT NULL,
	"front_document_id" uuid NOT NULL,
	"back_document_id" uuid NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewer_id" uuid
);
--> statement-breakpoint
CREATE TABLE "user_security" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"google_subject" text,
	"google_email" text,
	"facebook_subject" text,
	"facebook_name" text,
	"facebook_email" text,
	"totp_secret_enc" text,
	"totp_enabled_at" timestamp with time zone,
	"pending_totp_secret_enc" text,
	"pending_totp_expires_at" timestamp with time zone,
	"last_totp_step" integer DEFAULT -1 NOT NULL,
	"recovery_hashes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mfa_failures" integer DEFAULT 0 NOT NULL,
	"mfa_locked_until" timestamp with time zone,
	CONSTRAINT "user_security_google_subject_unique" UNIQUE("google_subject"),
	CONSTRAINT "user_security_facebook_subject_unique" UNIQUE("facebook_subject")
);
--> statement-breakpoint
CREATE TABLE "verification_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "security_challenges" ADD CONSTRAINT "security_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_verifications" ADD CONSTRAINT "teacher_verifications_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_verifications" ADD CONSTRAINT "teacher_verifications_front_document_id_verification_documents_id_fk" FOREIGN KEY ("front_document_id") REFERENCES "public"."verification_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_verifications" ADD CONSTRAINT "teacher_verifications_back_document_id_verification_documents_id_fk" FOREIGN KEY ("back_document_id") REFERENCES "public"."verification_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_verifications" ADD CONSTRAINT "teacher_verifications_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_security" ADD CONSTRAINT "user_security_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_reviews" ADD CONSTRAINT "verification_reviews_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_reviews" ADD CONSTRAINT "verification_reviews_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "security_challenges_user_idx" ON "security_challenges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "security_challenges_expiry_idx" ON "security_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "teacher_verifications_queue_idx" ON "teacher_verifications" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "verification_documents_owner_idx" ON "verification_documents" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "verification_reviews_teacher_idx" ON "verification_reviews" USING btree ("teacher_id","created_at");