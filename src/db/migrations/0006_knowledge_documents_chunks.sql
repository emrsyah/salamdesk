DO $$ BEGIN
  IF to_regclass('public.knowledge_base') IS NOT NULL
     AND to_regclass('public.knowledge_documents') IS NULL THEN
    ALTER TABLE "knowledge_base" RENAME TO "knowledge_documents";
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "summary" text;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "source_type" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "original_file_name" text;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "mime_type" text;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "file_size" integer;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "storage_key" text;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "checksum" text;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "ingestion_status" text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "ingestion_error" text;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_id" text NOT NULL,
  "content" text NOT NULL,
  "chunk_index" integer NOT NULL,
  "token_count" integer,
  "page_number" integer,
  "heading" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_chunks_document_id_knowledge_documents_id_fk') THEN
    ALTER TABLE "knowledge_chunks"
      ADD CONSTRAINT "knowledge_chunks_document_id_knowledge_documents_id_fk"
      FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_documents"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "knowledge_documents_module_id_idx" ON "knowledge_documents" ("module_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_documents_source_type_idx" ON "knowledge_documents" ("source_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_documents_ingestion_status_idx" ON "knowledge_documents" ("ingestion_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_chunks_document_id_idx" ON "knowledge_chunks" ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_chunks_chunk_index_idx" ON "knowledge_chunks" ("document_id", "chunk_index");--> statement-breakpoint

INSERT INTO "knowledge_chunks" ("document_id", "content", "chunk_index", "token_count")
SELECT
  d."id",
  d."content",
  0,
  CEIL(array_length(regexp_split_to_array(trim(d."content"), '\s+'), 1) * 1.3)::integer
FROM "knowledge_documents" d
WHERE trim(d."content") <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM "knowledge_chunks" c
    WHERE c."document_id" = d."id"
  );
