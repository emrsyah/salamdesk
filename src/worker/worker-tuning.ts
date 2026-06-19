import type { WorkerOptions } from "bullmq";

/**
 * Shared worker tuning to minimise *idle* Redis traffic on Upstash, which bills
 * per command. BullMQ long-polls the queue and runs a stalled-job sweep on a
 * timer even when nothing is happening; the defaults (5s / 30s) are tuned for a
 * dedicated Redis, not a pay-per-request one.
 *
 * Widening these only changes how often an idle worker re-polls — a newly added
 * job still wakes the blocking poll immediately, so job pickup latency is
 * unaffected. The only trade-off is that a job orphaned by a crashed worker
 * takes up to `stalledInterval` to be detected and retried.
 */
export const WORKER_TUNING = {
  // Long-poll up to 60s when the queue is empty (default 5s) → ~12× fewer idle polls.
  drainDelay: 60,
  // Sweep for stalled (crashed-mid-job) jobs every 5 min (default 30s).
  stalledInterval: 300_000,
} satisfies Partial<WorkerOptions>;
