/**
 * SalamDesk Worker Process
 *
 * Run with:   npx tsx src/worker/index.ts
 * Or:         bun run worker
 *
 * This process:
 *   1. Boots the Baileys WhatsApp WebSocket connection
 *   2. Starts the wa-inbound BullMQ worker (incoming WA messages → ticket DB)
 *   3. Starts the wa-outbound BullMQ worker (agent replies → WA)
 *
 * It must run alongside `bun dev` (Next.js) as a separate terminal process.
 * Both share the same Postgres DB and Redis instance.
 */

import "dotenv/config";
import IORedis from "ioredis";
import { Worker } from "bullmq";
import { connectToWhatsApp, getSocket } from "@/lib/whatsapp";
import { processInboundWaMessage } from "./bot";
import { createTriageWorker } from "./triage.worker";
import type { WaInboundJob, WaOutboundJob } from "@/lib/queue";

// ---------------------------------------------------------------------------
// Redis connection for workers (separate from the queue-producer connection)
// ---------------------------------------------------------------------------
const workerRedis = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  { maxRetriesPerRequest: null },
);

workerRedis.on("error", (err) => {
  console.error("[ioredis] Worker connection error:", err.message);
});

// ---------------------------------------------------------------------------
// wa-inbound worker: processes incoming WhatsApp messages
// ---------------------------------------------------------------------------
const inboundWorker = new Worker<WaInboundJob>(
  "wa-inbound",
  async (job) => {
    console.log(`[WORKER] Processing inbound job ${job.id} from ${job.data.phone}`);
    const result = await processInboundWaMessage(job.data);
    console.log(
      `[WORKER] Inbound job ${job.id} done — ${result.action} ticket ${result.ticketId}`,
    );
    return result;
  },
  {
    connection: workerRedis,
    concurrency: 5,
  },
);

inboundWorker.on("failed", (job, err) => {
  console.error(`[WORKER] Inbound job ${job?.id} failed:`, err.message);
});

// ---------------------------------------------------------------------------
// wa-outbound worker: sends agent replies back to WhatsApp
// ---------------------------------------------------------------------------
const outboundWorker = new Worker<WaOutboundJob>(
  "wa-outbound",
  async (job) => {
    const { phone, text } = job.data;
    const sock = getSocket();

    if (!sock) {
      throw new Error("WhatsApp socket not connected — will retry");
    }

    const jid = `${phone}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text });
    console.log(`[WORKER] Sent WA message to ${phone}: "${text.slice(0, 50)}"`);
  },
  {
    connection: workerRedis,
    concurrency: 3,
  },
);

outboundWorker.on("failed", (job, err) => {
  console.error(`[WORKER] Outbound job ${job?.id} failed:`, err.message);
});

// ---------------------------------------------------------------------------
// ai-triage worker: classifies tickets with AI after creation
// ---------------------------------------------------------------------------
const triageWorker = createTriageWorker(workerRedis);
console.log("[WORKER] AI triage worker started.");

// ---------------------------------------------------------------------------
// Boot WhatsApp connection
// ---------------------------------------------------------------------------
console.log("[WORKER] Starting SalamDesk worker process…");
console.log("[WORKER] Connecting to WhatsApp via Baileys…");

connectToWhatsApp().catch((err) => {
  console.error("[WORKER] Failed to connect to WhatsApp:", err);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
async function shutdown() {
  console.log("\n[WORKER] Shutting down gracefully…");
  await Promise.all([
    inboundWorker.close(),
    outboundWorker.close(),
    triageWorker.close(),
    workerRedis.quit(),
  ]);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
