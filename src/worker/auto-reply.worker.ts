import { Worker, type ConnectionOptions } from "bullmq";
import { and, count, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { ticketMessages, tickets } from "@/db/schema/tickets";
import { triageEvents } from "@/db/schema/triage";
import { AI_MODEL } from "@/lib/ai";
import type { AiAutoReplyJob } from "@/lib/queue";
import { getAiConfig } from "@/services/ai-config.service";
import { resolveReplyMode } from "@/lib/agent/business-hours";
import { sendWhatsAppMessage } from "@/services/whatsapp.service";
import { publishTicketEvent } from "@/lib/realtime";
import { WORKER_TUNING } from "./worker-tuning";
import { log } from "@/lib/logger";

const xlog = log("auto-reply");

/**
 * BullMQ worker for the "ai-auto-reply" queue (delayed sends).
 *
 * When auto-reply has a hold window configured, triage queues the drafted reply
 * here with a delay. When the job fires, we re-check whether the reply should
 * still go out — an agent may have replied, the ticket may have been
 * resolved/closed, auto-reply may have been disabled, or the per-ticket cap
 * reached. Only if all checks pass do we actually send.
 */
async function processAutoReply(job: { data: AiAutoReplyJob }) {
  const { ticketId, content, source, jid, queuedAt } = job.data;
  const queuedDate = new Date(queuedAt);

  const config = await getAiConfig();
  if (!config.autoReplyEnabled) {
    return cancel(ticketId, content, "Auto-reply disabled before the hold window elapsed.");
  }

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: { id: true, status: true, source: true, waPhone: true },
  });
  if (!ticket) {
    return cancel(ticketId, content, "Ticket no longer exists.");
  }

  // A human (or the requester via a new ticket) closing/resolving the ticket
  // means it's been handled — don't send.
  if (ticket.status === "resolved" || ticket.status === "closed") {
    return cancel(ticketId, content, `Ticket is ${ticket.status}; skipping auto-reply.`);
  }

  // Did a staff member publicly reply during the hold window? If so, back off.
  const [staffReply] = await db
    .select({ value: count() })
    .from(ticketMessages)
    .where(
      and(
        eq(ticketMessages.ticketId, ticketId),
        eq(ticketMessages.senderType, "staff"),
        eq(ticketMessages.isInternalNote, false),
        gt(ticketMessages.createdAt, queuedDate),
      ),
    );
  if ((staffReply?.value ?? 0) > 0) {
    return cancel(ticketId, content, "An agent replied during the hold window.");
  }

  // Respect the per-ticket auto-reply cap (in case multiple drafts queued).
  const [priorAuto] = await db
    .select({ value: count() })
    .from(ticketMessages)
    .where(
      and(
        eq(ticketMessages.ticketId, ticketId),
        eq(ticketMessages.senderType, "ai_agent"),
        eq(ticketMessages.isInternalNote, false),
      ),
    );
  if (
    config.limitAutoRepliesPerTicket &&
    (priorAuto?.value ?? 0) >= config.maxAutoRepliesPerTicket &&
    !job.data.isAiFirstReply
  ) {
    return cancel(ticketId, content, "Auto-reply limit already reached.");
  }

  // Re-check business hours at send time: a reply drafted inside hours but held
  // past the cutoff must not auto-send. Leaves the draft for staff review.
  if (config.businessHours && resolveReplyMode(config.businessHours, new Date()) === "draft-only") {
    return cancel(ticketId, content, "Hold window elapsed outside auto-reply hours.");
  }

  // All clear — send it.
  await db.insert(ticketMessages).values({
    ticketId,
    senderId: null,
    senderType: "ai_agent",
    content,
    isInternalNote: false,
    source: source as typeof ticket.source,
  });

  if (source === "whatsapp" && (jid ?? ticket.waPhone)) {
    await sendWhatsAppMessage((jid ?? ticket.waPhone)!, content, { typing: true });
  }

  await db.insert(triageEvents).values({
    ticketId,
    trigger: "scheduled",
    status: "completed",
    suggestedReply: content,
    autoReplyAllowed: true,
    autoReplySent: true,
    model: AI_MODEL,
  });

  // The held reply just landed in the thread — push it to open inboxes.
  await publishTicketEvent({ type: "ticket:updated", ticketId });
}

async function cancel(ticketId: string, content: string, reason: string) {
  xlog.info({ ticketId, reason }, "cancelled");
  await db.insert(triageEvents).values({
    ticketId,
    trigger: "scheduled",
    status: "completed",
    suggestedReply: content,
    autoReplyAllowed: false,
    autoReplySent: false,
    autoReplyBlockedReason: reason,
    model: AI_MODEL,
  });
}

export function createAutoReplyWorker(connection: ConnectionOptions) {
  const worker = new Worker<AiAutoReplyJob>("ai-auto-reply", processAutoReply, {
    connection,
    concurrency: 3,
    ...WORKER_TUNING,
  });

  worker.on("failed", (job, err) => {
    xlog.error(
      { jobId: job?.id, ticketId: job?.data?.ticketId, err },
      "job failed",
    );
  });

  return worker;
}
