CREATE TABLE IF NOT EXISTS "ticket_message_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "ticket_message_attachments"
		ADD CONSTRAINT "ticket_message_attachments_message_id_ticket_messages_id_fk"
		FOREIGN KEY ("message_id") REFERENCES "ticket_messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_message_attachments_message_id_idx"
ON "ticket_message_attachments" ("message_id");
