import { Worker, type ConnectionOptions } from "bullmq";
import { WORKER_TUNING } from "./worker-tuning";
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
import { publishDashboardEvent } from "@/lib/dashboard-events";
import { log } from "@/lib/logger";

const xlog = log("knowledge");

function getTempDir() {
  // `||` (not `??`) — an empty KNOWLEDGE_INGESTION_TMP_DIR="" in .env must
  // also fall back, otherwise we try to mkdir("").
  return (
    process.env.KNOWLEDGE_INGESTION_TMP_DIR?.trim() ||
    path.join(os.tmpdir(), "salamdesk-knowledge-ingestion")
  );
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
      const jlog = xlog.child({ jobId: job.id, documentId });

      jlog.info({ fileName }, "ingesting document");

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

        void publishDashboardEvent({
          type: "ingestion.progress",
          ticketId: null,
          label: `Menyerap KB "${fileName}": ${chunks.length} potongan`,
          documentId,
          title: fileName,
          stage: "chunking",
          detail: `${chunks.length} potongan`,
        });

        void publishDashboardEvent({
          type: "ingestion.progress",
          ticketId: null,
          label: `Membuat embedding "${fileName}"`,
          documentId,
          title: fileName,
          stage: "embedding",
          detail: `${chunks.length} potongan`,
        });
        const embeddings = await embedKnowledgeChunks(chunks.map((chunk) => chunk.content));
        await completeKnowledgeDocumentIngestion({
          id: documentId,
          content: extracted.text,
          chunks,
          embeddings,
        });

        jlog.info({ chunks: chunks.length }, "document ingested");
        void publishDashboardEvent({
          type: "ingestion.progress",
          ticketId: null,
          label: `KB siap: "${fileName}"`,
          documentId,
          title: fileName,
          stage: "ready",
          detail: `${chunks.length} potongan terindeks`,
        });
        return { documentId, chunks: chunks.length };
      } catch (error) {
        await failKnowledgeDocumentIngestion(documentId, error);
        void publishDashboardEvent({
          type: "ingestion.progress",
          ticketId: null,
          label: `Gagal menyerap "${fileName}"`,
          documentId,
          title: fileName,
          stage: "failed",
          detail: error instanceof Error ? error.message : "Unknown error",
        });
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
      ...WORKER_TUNING,
    }
  );

  worker.on("failed", (job, err) => {
    xlog.error({ jobId: job?.id, documentId: job?.data?.documentId, err }, "job failed");
  });

  return worker;
}
