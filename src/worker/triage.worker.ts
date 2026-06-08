import { Worker, type ConnectionOptions } from "bullmq";
import { triageTicket } from "@/services/ai.service";
import type { AiTriageJob } from "@/lib/queue";

/**
 * BullMQ worker for the "ai-triage" queue.
 *
 * Each job receives a ticketId and runs the full triage pipeline:
 *   1. Classify SIMRS module
 *   2. Reassess priority
 *   3. Search KB for relevant article
 *   4. Auto-reply if confidence ≥ 50%
 *
 * Export the createTriageWorker factory so worker/index.ts can pass
 * a shared Redis connection.
 */
export function createTriageWorker(connection: ConnectionOptions) {
  const worker = new Worker<AiTriageJob>(
    "ai-triage",
    async (job) => {
      console.log(`[TRIAGE] Processing job ${job.id} for ticket ${job.data.ticketId}`);
      const result = await triageTicket(job.data.ticketId, job.data.trigger ?? "intake");
      console.log(
        `[TRIAGE] Job ${job.id} done — module: ${result.moduleName ?? "unclassified"}, ` +
          `priority: ${result.priority}, autoReplied: ${result.autoReplied}`
      );
      return result;
    },
    {
      connection,
      concurrency: 3, // AI calls are slow — keep low to avoid rate limits
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[TRIAGE] Job ${job?.id} failed for ticket ${job?.data?.ticketId}:`, err.message);
  });

  return worker;
}
