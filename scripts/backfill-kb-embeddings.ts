/**
 * Backfill missing embeddings for knowledge_chunks.
 *
 * Chunks can end up without an embedding when documents are seeded directly
 * (scripts/seed-kb.ts) or ingested while VOYAGE_API_KEY was unset. Vector
 * search skips such chunks entirely (`embedding is not null`), so triage
 * silently degrades to keyword matching.
 *
 * Usage:  bun run tsx scripts/backfill-kb-embeddings.ts
 * Idempotent: only touches chunks where embedding IS NULL.
 */
import "dotenv/config";
import { db } from "@/db";
import { knowledgeChunks } from "@/db/schema/knowledge-base";
import { embedKnowledgeChunks } from "@/services/knowledge-embedding.service";
import { eq, isNull } from "drizzle-orm";

async function main() {
  const missing = await db
    .select({ id: knowledgeChunks.id, content: knowledgeChunks.content })
    .from(knowledgeChunks)
    .where(isNull(knowledgeChunks.embedding));

  if (missing.length === 0) {
    console.log("All chunks already embedded — nothing to do.");
    return;
  }

  console.log(`Embedding ${missing.length} chunk(s)…`);
  const embeddings = await embedKnowledgeChunks(missing.map((chunk) => chunk.content));

  let updated = 0;
  for (let index = 0; index < missing.length; index++) {
    await db
      .update(knowledgeChunks)
      .set({ embedding: embeddings[index] })
      .where(eq(knowledgeChunks.id, missing[index].id));
    updated++;
  }

  console.log(`Done. Embedded ${updated} chunk(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
