-- Knowledge articles can now belong to multiple modules.
-- Replace the single module_id FK with a module_ids uuid[] column.
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "module_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint

-- Backfill: carry the existing single module into the new array.
UPDATE "knowledge_documents"
  SET "module_ids" = ARRAY["module_id"]
  WHERE "module_id" IS NOT NULL
    AND cardinality("module_ids") = 0;--> statement-breakpoint

DROP INDEX IF EXISTS "knowledge_documents_module_id_idx";--> statement-breakpoint
ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "module_id";--> statement-breakpoint

-- GIN index supports fast `module_ids && ARRAY[...]` overlap filtering.
CREATE INDEX IF NOT EXISTS "knowledge_documents_module_ids_idx" ON "knowledge_documents" USING gin ("module_ids");
