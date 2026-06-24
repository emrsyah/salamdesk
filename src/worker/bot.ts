import { findOrCreateRequesterByPhone } from "@/services/whatsapp.service";
import { acknowledgeInbound } from "@/lib/whatsapp";
import {
  findLatestTicketByWaPhone,
  createTicket,
} from "@/services/ticket.service";
import {
  addRequesterMessageWithLifecycle,
  createReopenedFromLink,
  TicketLifecycleError,
} from "@/services/ticket-lifecycle.service";
import { aiTriageQueue } from "@/lib/queue";
import { publishTicketEvent } from "@/lib/realtime";
import { publishDashboardEvent } from "@/lib/dashboard-events";
import type { WaInboundJob } from "@/lib/queue";
import { log } from "@/lib/logger";

const xlog = log("bot");

/**
 * Process an inbound WhatsApp message.
 *
 * Decision tree:
 *   1. Find or create the reporter user by phone number.
 *   2. Look for an active (non-terminal) ticket from this phone.
 *      - If found → append the message as a new ticket_message.
 *      - If not found → create a new ticket (moduleId = null, to be triaged later).
 *
 * This function is called by the wa-inbound BullMQ worker.
 */
export async function processInboundWaMessage(job: WaInboundJob): Promise<{
  action: "created" | "appended" | "reopened" | "linked_created";
  ticketId: string;
}> {
  const { jid, phone, text, pushName, messageId, attachments } = job;

  // Acknowledge so the chat feels live — but with short, randomized human-like
  // beats (arrive → read → typing) instead of firing both instantly, which
  // reads as a bot. Best-effort and non-blocking — never delays ticket creation.
  void acknowledgeInbound(jid, messageId);

  // 1. Resolve or create the requester profile (keyed on phone for readability)
  // 2. Find the latest ticket for this contact. We key on the full addressing
  //    JID (stored in waPhone) so outbound replies route to the exact JID —
  //    a phone number alone can't distinguish @lid from @s.whatsapp.net.
  // These two lookups are independent, so run them together.
  const [requesterId, existingTicket] = await Promise.all([
    findOrCreateRequesterByPhone(phone, pushName),
    findLatestTicketByWaPhone(jid),
  ]);

  if (existingTicket && (existingTicket.status === "open" || existingTicket.status === "in_progress")) {
    // Append to the existing conversation thread
    await addRequesterMessageWithLifecycle({
      ticketId: existingTicket.id,
      requesterId,
      content: text,
      source: "whatsapp",
      attachments,
    });

    xlog.info(
      { ticketId: existingTicket.id, phone },
      "appended message to ticket",
    );

    await aiTriageQueue.add("triage", { ticketId: existingTicket.id, trigger: "message_added" });
    xlog.info({ ticketId: existingTicket.id }, "enqueued AI triage (message_added)");

    await publishTicketEvent({ type: "ticket:updated", ticketId: existingTicket.id });
    return { action: "appended", ticketId: existingTicket.id };
  }

  if (existingTicket?.status === "resolved") {
    try {
      await addRequesterMessageWithLifecycle({
        ticketId: existingTicket.id,
        requesterId,
        content: text,
        source: "whatsapp",
        attachments,
      });

      await aiTriageQueue.add("triage", { ticketId: existingTicket.id, trigger: "message_added" });
      xlog.info({ ticketId: existingTicket.id }, "enqueued AI triage (message_added) for reopened ticket");

      await publishTicketEvent({ type: "ticket:updated", ticketId: existingTicket.id });
      return { action: "reopened", ticketId: existingTicket.id };
    } catch (error) {
      if (!(error instanceof TicketLifecycleError)) throw error;
    }
  }

  // 3. Create a fresh ticket
  // Title: first 100 chars of the message (WA messages are often short
  // descriptions); a media-only message falls back to a type-aware placeholder.
  const mediaMime = attachments?.[0]?.mimeType ?? "";
  const mediaPlaceholder = mediaMime.startsWith("audio/")
    ? "[Pesan suara]"
    : mediaMime === "application/pdf"
      ? "[Dokumen]"
      : "[Gambar]";
  const title = text.trim()
    ? text.length > 100
      ? `${text.slice(0, 97)}…`
      : text
    : attachments?.length
      ? mediaPlaceholder
      : text;

  const { id: ticketId } = await createTicket({
    title,
    description: text,
    moduleId: null, // Will be triaged manually or by AI in Phase 5
    priority: "medium",
    source: "whatsapp",
    requesterId,
    waPhone: jid, // full addressing JID — used to route outbound replies
    attachments,
  });

  xlog.info({ ticketId, jid, pushName: pushName ?? "unknown" }, "created ticket");

  // A booth visitor arrives via the exhibition QR, whose prefill seeds the first
  // message — flag those so the wall can spotlight them.
  const prefill = process.env.EXHIBIT_WA_PREFILL?.trim();
  const boothVisitor =
    !!prefill && text.trim().toLowerCase().includes(prefill.toLowerCase());
  void publishDashboardEvent({
    type: "ticket.new",
    ticketId,
    label: boothVisitor
      ? `👋 Pengunjung booth: ${pushName ?? phone}`
      : `Pesan baru dari ${pushName ?? phone}`,
    requesterName: pushName ?? null,
    preview: text.slice(0, 160),
    channel: "whatsapp",
    boothVisitor,
  });

  await publishTicketEvent({ type: "ticket:created", ticketId });
  // New WhatsApp ticket = a fresh customer message; alert in-scope agents.
  // Module/assignee are null until triage runs, so only privileged staff are
  // alerted client-side (operators get pinged once it's triaged into a module).
  await publishTicketEvent({
    type: "message:received",
    ticketId,
    moduleId: null,
    assigneeId: null,
    requesterName: pushName ?? null,
    preview: text.slice(0, 120),
  });

  // Enqueue AI triage — classifies module, priority, and searches KB
  await aiTriageQueue.add("triage", { ticketId, trigger: "intake" });
  xlog.info({ ticketId }, "enqueued AI triage");

  if (existingTicket && (existingTicket.status === "closed" || existingTicket.status === "resolved")) {
    await createReopenedFromLink({
      sourceTicketId: existingTicket.id,
      targetTicketId: ticketId,
    });
    return { action: "linked_created", ticketId };
  }

  return { action: "created", ticketId };
}
