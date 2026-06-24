import { Worker, type ConnectionOptions } from "bullmq";
import { startActiveObservation, propagateAttributes } from "@langfuse/tracing";
import { triageTicket } from "@/services/ai.service";
import { publishTicketEvent } from "@/lib/realtime";
import { WORKER_TUNING } from "./worker-tuning";
import { log } from "@/lib/logger";
import type { AiTriageJob } from "@/lib/queue";

const xlog = log("triage");

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
      const jlog = xlog.child({ jobId: job.id, ticketId: job.data.ticketId });
      jlog.info("processing job");
      const trigger = job.data.trigger ?? "intake";
      try {
        // Group every LLM call for this ticket (module, priority, on-topic, KB,
        // procedure) under one Langfuse trace, keyed by ticketId so a ticket's
        // full triage history shows up together in the Sessions view.
        const result = await propagateAttributes(
          {
            sessionId: job.data.ticketId,
            tags: ["triage", trigger],
            metadata: { jobId: job.id ?? "unknown", trigger },
          },
          () =>
            startActiveObservation("triage-ticket", async (span) => {
              span.update({ input: { ticketId: job.data.ticketId, trigger } });
              const r = await triageTicket(job.data.ticketId, trigger);
              span.update({
                output: {
                  moduleName: r.moduleName,
                  priority: r.priority,
                  autoReplied: r.autoReplied,
                  autoReplyBlockedReason: r.autoReplyBlockedReason,
                },
              });
              return r;
            }),
        );
        jlog.info(
          {
            moduleName: result.moduleName ?? "unclassified",
            priority: result.priority,
            autoReplied: result.autoReplied,
            autoReplyBlockedReason: result.autoReplyBlockedReason ?? null,
          },
          "job done",
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
    xlog.error({ jobId: job?.id, ticketId: job?.data?.ticketId, err }, "job failed");
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
