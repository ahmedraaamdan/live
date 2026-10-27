CREATE TABLE "board_ops" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"lecture_id" uuid NOT NULL,
	"op" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board_ops" ADD CONSTRAINT "board_ops_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_ops_lecture_idx" ON "board_ops" USING btree ("lecture_id","seq");