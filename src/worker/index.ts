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
import { Worker, type ConnectionOptions } from "bullmq";
import { connectToWhatsApp, disconnectWhatsApp, getSocket } from "@/lib/whatsapp";
import { processInboundWaMessage } from "./bot";
import { createTriageWorker } from "./triage.worker";
import { createTicketLifecycleWorker } from "./ticket-lifecycle.worker";
import { createKnowledgeIngestionWorker } from "./knowledge-ingestion.worker";
import { ticketLifecycleQueue, TICKET_LIFECYCLE_JOBS, type WaInboundJob, type WaOutboundJob } from "@/lib/queue";

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

const connection = workerRedis as ConnectionOptions;

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
    connection,
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
    const { jid, text, attachments = [] } = job.data;
    const sock = getSocket();

    if (!sock) {
      throw new Error("WhatsApp socket not connected — will retry");
    }

    // jid already carries the correct domain (@lid or @s.whatsapp.net) — send
    // it verbatim. Reconstructing "<num>@s.whatsapp.net" from a LID silently
    // sends to a non-existent number (sendMessage doesn't throw on bad JIDs).
    if (!jid?.includes("@")) {
      // A bare value means the ticket predates the full-JID fix — back-fill
      // with: bun run tsx scripts/migrate-wa-jid.ts --apply
      throw new Error(
        `Invalid WhatsApp JID "${jid}" — expected "<id>@s.whatsapp.net" or "<id>@lid". ` +
          `Run scripts/migrate-wa-jid.ts to fix legacy tickets.`,
      );
    }

    if (attachments.length === 0) {
      await sock.sendMessage(jid, { text });
    } else {
      // Attach the reply text as the caption of the first media item so the
      // requester sees one coherent message; remaining items send bare.
      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];
        const caption = i === 0 && text ? text : undefined;
        const isImage = attachment.mimeType.startsWith("image/");
        const media = isImage
          ? { image: { url: attachment.url }, caption }
          : {
              document: { url: attachment.url },
              fileName: attachment.fileName,
              mimetype: attachment.mimeType,
              caption,
            };
        await sock.sendMessage(jid, media);
      }
    }
    console.log(
      `[WORKER] Sent WA message to ${jid}: "${text.slice(0, 50)}"` +
        (attachments.length ? ` (+${attachments.length} attachment(s))` : ""),
    );
  },
  {
    connection,
    concurrency: 3,
  },
);

outboundWorker.on("failed", (job, err) => {
  console.error(`[WORKER] Outbound job ${job?.id} failed:`, err.message);
});

// ---------------------------------------------------------------------------
// ai-triage worker: classifies tickets with AI after creation
// ---------------------------------------------------------------------------
const triageWorker = createTriageWorker(connection);
console.log("[WORKER] AI triage worker started.");

const ticketLifecycleWorker = createTicketLifecycleWorker(connection);
console.log("[WORKER] Ticket lifecycle worker started.");

const knowledgeIngestionWorker = createKnowledgeIngestionWorker(connection);
console.log("[WORKER] Knowledge ingestion worker started.");

await ticketLifecycleQueue.add(TICKET_LIFECYCLE_JOBS.autoCloseResolved, {}, {
  repeat: { every: 15 * 60 * 1000 },
  jobId: TICKET_LIFECYCLE_JOBS.autoCloseResolved,
});

await ticketLifecycleQueue.add(TICKET_LIFECYCLE_JOBS.scanTicketSlas, {}, {
  repeat: { every: 5 * 60 * 1000 },
  jobId: TICKET_LIFECYCLE_JOBS.scanTicketSlas,
});

// ---------------------------------------------------------------------------
// wa-control subscriber: receives commands from the web app (e.g. disconnect).
// Needs its own connection because ioredis enters a dedicated subscriber mode.
// ---------------------------------------------------------------------------
const controlRedis = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  { maxRetriesPerRequest: null },
);

controlRedis.on("error", (err) => {
  console.error("[ioredis] Control connection error:", err.message);
});

controlRedis.subscribe("wa-control", (err) => {
  if (err) console.error("[WORKER] Failed to subscribe to wa-control:", err.message);
  else console.log("[WORKER] Subscribed to wa-control channel.");
});

controlRedis.on("message", async (channel, message) => {
  if (channel !== "wa-control") return;
  if (message === "disconnect") {
    console.log("[WORKER] Received disconnect command.");
    try {
      await disconnectWhatsApp();
    } catch (err) {
      console.error("[WORKER] disconnectWhatsApp failed:", err);
    }
  }
});

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
    ticketLifecycleWorker.close(),
    knowledgeIngestionWorker.close(),
    controlRedis.quit(),
    workerRedis.quit(),
  ]);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
