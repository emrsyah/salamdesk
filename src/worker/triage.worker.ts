import { Worker, type ConnectionOptions } from "bullmq";
import { triageTicket } from "@/services/ai.service";
import { publishTicketEvent } from "@/lib/realtime";
import { WORKER_TUNING } from "./worker-tuning";
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
      try {
        const result = await triageTicket(job.data.ticketId, job.data.trigger ?? "intake");
        console.log(
          `[TRIAGE] Job ${job.id} done — module: ${result.moduleName ?? "unclassified"}, ` +
            `priority: ${result.priority}, autoReplied: ${result.autoReplied}` +
            (result.autoReplied
              ? result.autoReplyBlockedReason
                ? ` (${result.autoReplyBlockedReason})`
                : ""
              : ` — reason: ${result.autoReplyBlockedReason ?? "no reply generated"}`)
        );
        // Clears the live "menganalisis…" state and pulls in the fresh
        // module/priority/AI suggestion on connected clients.
        await publishTicketEvent({
          type: "triage:completed",
          ticketId: job.data.ticketId,
          status: "completed",
        });
        return result;
      } catch (err) {
        // Don't publish "failed" here: BullMQ will retry per the queue backoff,
        // and flipping the badge to failed each attempt makes it flicker
        // failed→spinning→failed. We only surface failure once retries are
        // exhausted (see the "failed" listener below).
        throw err;
      }
    },
    {
      connection,
      concurrency: 3, // AI calls are slow — keep low to avoid rate limits
      ...WORKER_TUNING,
    }
  );

  worker.on("failed", async (job, err) => {
    console.error(`[TRIAGE] Job ${job?.id} failed for ticket ${job?.data?.ticketId}:`, err.message);
    if (!job) return;
    // Only flip the inbox badge to "failed" once all retries are spent — until
    // then the ticket is still being worked, so the spinner should remain.
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      await publishTicketEvent({
        type: "triage:completed",
        ticketId: job.data.ticketId,
        status: "failed",
      });
    }
  });

  return worker;
}
