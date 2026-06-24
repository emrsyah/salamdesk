import { Queue, type ConnectionOptions, type Worker } from "bullmq";
import { redisConnection } from "@/lib/redis";
import { log } from "@/lib/logger";

const dlqLog = log("dlq");

/**
 * Dead-letter queue: a holding pen for jobs that exhausted all retries.
 *
 * Without this, a permanently-failed job lives in the source queue's `failed`
 * set and is silently evicted once `removeOnFail` is hit — no audit, no replay.
 * Here we copy the final-failure context into a dedicated queue that has *no*
 * worker (so it adds zero polling load) and never auto-removes, leaving the
 * record for inspection or manual re-enqueue.
 */
export const deadLetterQueue = new Queue("dead-letter", {
  connection: redisConnection as ConnectionOptions,
  defaultJobOptions: {
    removeOnComplete: false,
    removeOnFail: false,
  },
});

export type DeadLetterRecord = {
  queue: string;
  jobId: string | undefined;
  name: string;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
  timestamp: string;
};

/**
 * Attach a final-failure listener that dead-letters a job once its retries are
 * exhausted. `failed` fires on every attempt, so we only record once the
 * configured `attempts` have all been used.
 */
export function registerDeadLetter(worker: Worker, queueName: string): void {
  worker.on("failed", async (job, err) => {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) return; // more retries coming — not dead yet

    try {
      await deadLetterQueue.add("dead-letter", {
        queue: queueName,
        jobId: job.id,
        name: job.name,
        data: job.data,
        failedReason: err?.message ?? String(err),
        attemptsMade: job.attemptsMade,
        timestamp: new Date().toISOString(),
      } satisfies DeadLetterRecord);
      dlqLog.error(
        { queue: queueName, jobId: job.id, attemptsMade: job.attemptsMade, reason: err?.message },
        "job dead-lettered",
      );
    } catch (dlqErr) {
      dlqLog.error(
        { queue: queueName, jobId: job.id, err: dlqErr },
        "failed to record dead letter",
      );
    }
  });
}
