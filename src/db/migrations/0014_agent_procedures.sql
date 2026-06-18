CREATE TABLE IF NOT EXISTS "agent_procedures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "when_to_use" text DEFAULT '' NOT NULL,
  "content" jsonb NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_procedures_enabled_idx" ON "agent_procedures" ("enabled");
