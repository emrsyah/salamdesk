CREATE TABLE IF NOT EXISTS "triage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" text NOT NULL,
  "trigger" text DEFAULT 'intake' NOT NULL,
  "status" text NOT NULL,
  "module_id" uuid,
  "module_name" text,
  "module_confidence" numeric(4, 2),
  "module_reason" text,
  "priority" text,
  "priority_reason" text,
  "suggested_kb_id" text,
  "suggested_kb_title" text,
  "reply_confidence" numeric(4, 2),
  "suggested_reply" text,
  "auto_reply_allowed" boolean,
  "auto_reply_sent" boolean DEFAULT false NOT NULL,
  "auto_reply_blocked_reason" text,
  "model" text,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'triage_events_ticket_id_tickets_id_fk') THEN EXECUTE 'ALTER TABLE "triage_events" ADD CONSTRAINT "triage_events_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE CASCADE'; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'triage_events_suggested_kb_id_knowledge_base_id_fk') THEN EXECUTE 'ALTER TABLE "triage_events" ADD CONSTRAINT "triage_events_suggested_kb_id_knowledge_base_id_fk" FOREIGN KEY ("suggested_kb_id") REFERENCES "public"."knowledge_base"("id") ON DELETE SET NULL'; END IF; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "triage_events_ticket_id_idx" ON "triage_events" ("ticket_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "triage_events_created_at_idx" ON "triage_events" ("created_at");
