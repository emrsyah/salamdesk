-- Procedures master switch (runtime on/off) and AI-first always-answer mode.
ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "procedures_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "ai_first_mode" boolean DEFAULT true NOT NULL;
