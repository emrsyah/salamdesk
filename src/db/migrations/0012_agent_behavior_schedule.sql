ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "agent_name" text DEFAULT 'Asisten' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "persona" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "tone" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "language" text DEFAULT 'id' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "reply_signature" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "guardrails" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "business_hours" jsonb;
