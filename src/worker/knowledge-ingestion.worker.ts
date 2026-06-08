import { Worker, type ConnectionOptions } from "bullmq";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { KnowledgeIngestionJob } from "@/lib/queue";
import { chunkKnowledgeContent } from "@/services/knowledge-chunking.service";
import { embedKnowledgeChunks } from "@/services/knowledge-embedding.service";
import { extractKnowledgeDocument } from "@/services/knowledge-extraction.service";
import {
  completeKnowledgeDocumentIngestion,
  failKnowledgeDocumentIngestion,
  markKnowledgeDocumentProcessing,
} from "@/services/knowledge.service";

function getTempDir() {
  return process.env.KNOWLEDGE_INGESTION_TMP_DIR ?? path.join(os.tmpdir(), "salamdesk-knowledge-ingestion");
}

async function downloadToTempFile(jobId: string | undefined, data: KnowledgeIngestionJob) {
  const response = await fetch(data.fileUrl);

  if (!response.ok) {
    throw new Error(`Failed to download uploaded file: ${response.status} ${response.statusText}`);
  }

  const directory = getTempDir();
  await mkdir(directory, { recursive: true });

  const extension = path.extname(data.fileName);
  const filePath = path.join(directory, `${data.documentId}-${jobId ?? crypto.randomUUID()}${extension}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(filePath, buffer);
  return filePath;
}

export function createKnowledgeIngestionWorker(connection: ConnectionOptions) {
  const worker = new Worker<KnowledgeIngestionJob>(
    "knowledge-ingestion",
    async (job) => {
      const { documentId, fileName, mimeType } = job.data;
      let filePath: string | null = null;

      console.log(`[KNOWLEDGE] Ingesting document ${documentId}: ${fileName}`);

      try {
        await markKnowledgeDocumentProcessing(documentId);
        filePath = await downloadToTempFile(job.id, job.data);

        const extracted = await extractKnowledgeDocument({ filePath, fileName, mimeType });
        const chunkSources = extracted.pages?.length
          ? extracted.pages.map((page) => ({
              content: page.text,
              pageNumber: page.pageNumber,
              metadata: { source: "page" },
            }))
          : extracted.text;
        const chunks = chunkKnowledgeContent(chunkSources);

        if (chunks.length === 0) {
          throw new Error("No text could be extracted from the uploaded document");
        }

        const embeddings = await embedKnowledgeChunks(chunks.map((chunk) => chunk.content));
        await completeKnowledgeDocumentIngestion({
          id: documentId,
          content: extracted.text,
          chunks,
          embeddings,
        });

        console.log(`[KNOWLEDGE] Document ${documentId} ingested with ${chunks.length} chunks`);
        return { documentId, chunks: chunks.length };
      } catch (error) {
        await failKnowledgeDocumentIngestion(documentId, error);
        throw error;
      } finally {
        if (filePath) {
          await rm(filePath, { force: true });
        }
      }
    },
    {
      connection,
      concurrency: 2,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[KNOWLEDGE] Job ${job?.id} failed for document ${job?.data?.documentId}:`, err.message);
  });

  return worker;
}
