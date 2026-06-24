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
import { initObservability, flushTraces } from "@/lib/langfuse";

// Enable Langfuse tracing before any AI SDK call is loaded/executed.
initObservability();

import IORedis from "ioredis";
import { Worker, type ConnectionOptions } from "bullmq";
import { log } from "@/lib/logger";
import { connectToWhatsApp, disconnectWhatsApp, reconnectWhatsApp, getSocket } from "@/lib/whatsapp";
import { processInboundWaMessage } from "./bot";
import { createTriageWorker } from "./triage.worker";
import { createAutoReplyWorker } from "./auto-reply.worker";
import { createTicketLifecycleWorker } from "./ticket-lifecycle.worker";
import { createKnowledgeIngestionWorker } from "./knowledge-ingestion.worker";
import { WORKER_TUNING } from "./worker-tuning";
import { registerDeadLetter } from "./dead-letter";
import { ticketLifecycleQueue, TICKET_LIFECYCLE_JOBS, type WaInboundJob, type WaOutboundJob } from "@/lib/queue";

// ---------------------------------------------------------------------------
// Redis connection for workers (separate from the queue-producer connection)
// ---------------------------------------------------------------------------
const wlog = log("worker");
const redisLog = log("ioredis");

const workerRedis = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  { maxRetriesPerRequest: null },
);

workerRedis.on("error", (err) => {
  redisLog.error({ err }, "worker connection error");
});

const connection = workerRedis as ConnectionOptions;

// ---------------------------------------------------------------------------
// wa-inbound worker: processes incoming WhatsApp messages
// ---------------------------------------------------------------------------
const inboundLog = log("wa-inbound");
const inboundWorker = new Worker<WaInboundJob>(
  "wa-inbound",
  async (job) => {
    const jlog = inboundLog.child({ jobId: job.id, phone: job.data.phone });
    jlog.info("processing inbound job");
    const result = await processInboundWaMessage(job.data);
    jlog.info(
      { action: result.action, ticketId: result.ticketId },
      "inbound job done",
    );
    return result;
  },
  {
    connection,
    concurrency: 5,
    ...WORKER_TUNING,
  },
);

inboundWorker.on("failed", (job, err) => {
  inboundLog.error({ jobId: job?.id, err }, "inbound job failed");
});

// ---------------------------------------------------------------------------
// wa-outbound worker: sends agent replies back to WhatsApp
// ---------------------------------------------------------------------------
const outboundLog = log("wa-outbound");
const outboundWorker = new Worker<WaOutboundJob>(
  "wa-outbound",
  async (job) => {
    const jlog = outboundLog.child({ jobId: job.id });
    const { jid, text, attachments = [], typing = false } = job.data;
    const sock = getSocket();

    if (!sock) {
      throw new Error("WhatsApp socket not connected — will retry");
    }

    // For AI replies, re-assert "typing…" right before sending (the inbound
    // composing presence has long since expired) and hold for a short,
    // length-scaled beat so the reply lands at a believably human cadence
    // instead of snapping in instantly. Cosmetic — guarded so it never blocks.
    if (typing && jid?.includes("@")) {
      try {
        await sock.sendPresenceUpdate("composing", jid);
        const pauseMs = Math.min(1500, Math.max(500, text.length * 15));
        await new Promise((r) => setTimeout(r, pauseMs));
        await sock.sendPresenceUpdate("paused", jid);
      } catch (err) {
        jlog.warn({ jid, err }, "typing presence failed");
      }
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
    jlog.info(
      { jid, attachments: attachments.length, preview: text.slice(0, 50) },
      "sent WA message",
    );
  },
  {
    connection,
    concurrency: 3,
    ...WORKER_TUNING,
  },
);

outboundWorker.on("failed", (job, err) => {
  outboundLog.error({ jobId: job?.id, err }, "outbound job failed");
});

// ---------------------------------------------------------------------------
// ai-triage worker: classifies tickets with AI after creation
// ---------------------------------------------------------------------------
const triageWorker = createTriageWorker(connection);
wlog.info("AI triage worker started");

const autoReplyWorker = createAutoReplyWorker(connection);
wlog.info("AI auto-reply (delayed) worker started");

const ticketLifecycleWorker = createTicketLifecycleWorker(connection);
wlog.info("ticket lifecycle worker started");

const knowledgeIngestionWorker = createKnowledgeIngestionWorker(connection);
wlog.info("knowledge ingestion worker started");

// Capture permanently-failed jobs from every queue into the dead-letter queue.
registerDeadLetter(inboundWorker, "wa-inbound");
registerDeadLetter(outboundWorker, "wa-outbound");
registerDeadLetter(triageWorker, "ai-triage");
registerDeadLetter(autoReplyWorker, "ai-auto-reply");
registerDeadLetter(ticketLifecycleWorker, "ticket-lifecycle");
registerDeadLetter(knowledgeIngestionWorker, "knowledge-ingestion");

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
const ctrlLog = log("wa-control");
const controlRedis = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  { maxRetriesPerRequest: null },
);

controlRedis.on("error", (err) => {
  redisLog.error({ err }, "control connection error");
});

controlRedis.subscribe("wa-control", (err) => {
  if (err) ctrlLog.error({ err }, "failed to subscribe to wa-control");
  else ctrlLog.info("subscribed to wa-control channel");
});

controlRedis.on("message", async (channel, message) => {
  if (channel !== "wa-control") return;
  if (message === "disconnect") {
    ctrlLog.info("received disconnect command");
    try {
      await disconnectWhatsApp();
    } catch (err) {
      ctrlLog.error({ err }, "disconnectWhatsApp failed");
    }
  } else if (message === "reconnect") {
    ctrlLog.info("received reconnect command");
    try {
      await reconnectWhatsApp();
    } catch (err) {
      ctrlLog.error({ err }, "reconnectWhatsApp failed");
    }
  }
});

// ---------------------------------------------------------------------------
// Boot WhatsApp connection
// ---------------------------------------------------------------------------
wlog.info("starting SalamDesk worker process");
wlog.info("connecting to WhatsApp via Baileys");

connectToWhatsApp().catch((err) => {
  wlog.fatal({ err }, "failed to connect to WhatsApp");
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
async function shutdown() {
  wlog.info("shutting down gracefully");
  await Promise.all([
    inboundWorker.close(),
    outboundWorker.close(),
    triageWorker.close(),
    autoReplyWorker.close(),
    ticketLifecycleWorker.close(),
    knowledgeIngestionWorker.close(),
    controlRedis.quit(),
    workerRedis.quit(),
  ]);
  // Ship any buffered traces to Langfuse before the process exits.
  await flushTraces();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
