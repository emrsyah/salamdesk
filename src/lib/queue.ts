import { Queue, type ConnectionOptions } from "bullmq";
import { redisConnection } from "./redis";

const connection = redisConnection as ConnectionOptions;

/**
 * Inbound WA messages → processed by the worker to create/append tickets.
 */
export const waInboundQueue = new Queue("wa-inbound", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 500,
    removeOnFail: 200,
  },
});

/**
 * Outbound WA messages → processed by the worker to call Baileys sock.sendMessage().
 */
export const waOutboundQueue = new Queue("wa-outbound", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 500,
    removeOnFail: 200,
  },
});

/**
 * AI triage jobs → processed by the worker to classify module/priority and search KB.
 */
export const aiTriageQueue = new Queue("ai-triage", {
  connection,
  defaultJobOptions: {
    // Retry transient failures (DB statement timeouts, AI rate limits) with
    // exponential backoff: ~5s, then ~10s. The worker now re-throws on error.
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 500,
    removeOnFail: 200,
  },
});

export const ticketLifecycleQueue = new Queue("ticket-lifecycle", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 500,
    removeOnFail: 200,
  },
});

/**
 * Delayed AI auto-replies → a drafted reply is held for N minutes so an agent
 * can intercept; the worker re-checks for human activity before sending.
 */
export const aiAutoReplyQueue = new Queue("ai-auto-reply", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 500,
    removeOnFail: 200,
  },
});

export const knowledgeIngestionQueue = new Queue("knowledge-ingestion", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 500,
    removeOnFail: 200,
  },
});

export const TICKET_LIFECYCLE_JOBS = {
  autoCloseResolved: "auto-close-resolved",
  scanTicketSlas: "scan-ticket-slas",
} as const;

export const KNOWLEDGE_INGESTION_JOBS = {
  ingestDocument: "ingest-document",
} as const;

export type WaInboundJob = {
  // Full WhatsApp addressing JID, e.g. "6281234567890@s.whatsapp.net" or
  // "80646684844239@lid". This is what we reply to — never reconstruct it.
  jid: string;
  // Human-readable phone number, e.g. "6281234567890". Resolved from the LID
  // mapping when possible; falls back to the JID's local part. For display
  // and requester profiles only — NOT for addressing outbound messages.
  phone: string;
  text: string;
  pushName: string | null;
  messageId: string;
};

export type WaOutboundAttachment = {
  // Publicly reachable URL (uploadthing) Baileys fetches when sending.
  url: string;
  fileName: string;
  mimeType: string;
};

export type WaOutboundJob = {
  // Full WhatsApp addressing JID to send to (carries the @lid / @s.whatsapp.net
  // domain). Passed straight to sock.sendMessage() — do not append a domain.
  jid: string;
  text: string;
  // Optional media to send alongside the text (images inline, others as docs).
  attachments?: WaOutboundAttachment[];
};

export type AiTriageJob = {
  ticketId: string;
  trigger?: "intake" | "manual" | "message_added" | "retry";
};

export type AiAutoReplyJob = {
  ticketId: string;
  content: string;
  source: string;
  // Full WhatsApp JID to send to, or null for non-WA sources.
  jid: string | null;
  // ISO timestamp the reply was drafted/queued — used to detect whether a human
  // replied during the hold window.
  queuedAt: string;
};

export type TicketLifecycleJob = Record<string, never>;

export type KnowledgeIngestionJob = {
  documentId: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
};
