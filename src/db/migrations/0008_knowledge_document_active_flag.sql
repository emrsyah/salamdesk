ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_documents_is_active_idx" ON "knowledge_documents" ("is_active");
