CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint

ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "file_url" text;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "embedding" vector(1024);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "knowledge_chunks_embedding_idx"
ON "knowledge_chunks"
USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
