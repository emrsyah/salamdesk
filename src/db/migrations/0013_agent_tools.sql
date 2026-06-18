CREATE TABLE IF NOT EXISTS "agent_credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "kind" text NOT NULL,
  "secret_encrypted" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_tools" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "type" text NOT NULL,
  "config" jsonb NOT NULL,
  "credential_id" uuid,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "agent_tools" ADD CONSTRAINT "agent_tools_credential_id_fk"
    FOREIGN KEY ("credential_id") REFERENCES "agent_credentials"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_tools_enabled_idx" ON "agent_tools" ("enabled");
