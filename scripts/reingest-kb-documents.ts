/**
 * Re-enqueue ingestion for uploaded KB documents stuck in `failed` (or
 * `processing`, e.g. after a worker crash).
 *
 * Usage:
 *   bun run tsx scripts/reingest-kb-documents.ts            # all failed docs
 *   bun run tsx scripts/reingest-kb-documents.ts <docId>    # one specific doc
 *
 * The worker must be running (and on current code) to pick the jobs up.
 */
import "dotenv/config";
import { db } from "@/db";
import { knowledgeDocuments } from "@/db/schema/knowledge-base";
import { KNOWLEDGE_INGESTION_JOBS, knowledgeIngestionQueue } from "@/lib/queue";
import { redisConnection } from "@/lib/redis";
import { and, eq, inArray, isNotNull } from "drizzle-orm";

async function main() {
  const onlyId = process.argv[2];

  const docs = await db
    .select({
      id: knowledgeDocuments.id,
      title: knowledgeDocuments.title,
      fileUrl: knowledgeDocuments.fileUrl,
      originalFileName: knowledgeDocuments.originalFileName,
      mimeType: knowledgeDocuments.mimeType,
      ingestionStatus: knowledgeDocuments.ingestionStatus,
    })
    .from(knowledgeDocuments)
    .where(
      and(
        onlyId
          ? eq(knowledgeDocuments.id, onlyId)
          : inArray(knowledgeDocuments.ingestionStatus, ["failed", "processing"]),
        isNotNull(knowledgeDocuments.fileUrl),
      ),
    );

  if (docs.length === 0) {
    console.log("No documents to re-ingest.");
    return;
  }

  for (const doc of docs) {
    await knowledgeIngestionQueue.add(KNOWLEDGE_INGESTION_JOBS.ingestDocument, {
      documentId: doc.id,
      fileUrl: doc.fileUrl!,
      fileName: doc.originalFileName ?? "document",
      mimeType: doc.mimeType ?? "application/octet-stream",
    });
    console.log(`Re-enqueued [${doc.ingestionStatus}] "${doc.title}" (${doc.id})`);
  }

  console.log(`Done. ${docs.length} document(s) re-enqueued.`);
}

main()
  .then(async () => {
    await knowledgeIngestionQueue.close();
    await redisConnection.quit();
    process.exit(0);
  })
  .catch((err) => {
    console.error("Re-ingest failed:", err);
    process.exit(1);
  });
