import { findOrCreateRequesterByPhone } from "@/services/whatsapp.service";
import { markMessageRead, sendTypingPresence } from "@/lib/whatsapp";
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
import type { WaInboundJob } from "@/lib/queue";

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
  const { jid, phone, text, pushName, messageId } = job;

  // Acknowledge instantly so the chat feels live: blue ticks + "typing…" the
  // moment the message lands, well before triage finishes composing a reply.
  // Best-effort and non-blocking — presence must never delay ticket creation.
  void markMessageRead(jid, messageId);
  void sendTypingPresence(jid, true);

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
    });

    console.log(
      `[BOT] Appended message to ticket ${existingTicket.id} from ${phone}`,
    );

    await aiTriageQueue.add("triage", { ticketId: existingTicket.id, trigger: "message_added" });
    console.log(`[BOT] Enqueued AI triage (message_added) for ticket ${existingTicket.id}`);

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
      });
      
      await aiTriageQueue.add("triage", { ticketId: existingTicket.id, trigger: "message_added" });
      console.log(`[BOT] Enqueued AI triage (message_added) for reopened ticket ${existingTicket.id}`);

      await publishTicketEvent({ type: "ticket:updated", ticketId: existingTicket.id });
      return { action: "reopened", ticketId: existingTicket.id };
    } catch (error) {
      if (!(error instanceof TicketLifecycleError)) throw error;
    }
  }

  // 3. Create a fresh ticket
  // Title: first 100 chars of the message (WA messages are often short descriptions)
  const title =
    text.length > 100 ? `${text.slice(0, 97)}…` : text;

  const { id: ticketId } = await createTicket({
    title,
    description: text,
    moduleId: null, // Will be triaged manually or by AI in Phase 5
    priority: "medium",
    source: "whatsapp",
    requesterId,
    waPhone: jid, // full addressing JID — used to route outbound replies
  });

  console.log(`[BOT] Created ticket ${ticketId} for ${jid} (${pushName ?? "unknown"})`);

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
  console.log(`[BOT] Enqueued AI triage for ticket ${ticketId}`);

  if (existingTicket && (existingTicket.status === "closed" || existingTicket.status === "resolved")) {
    await createReopenedFromLink({
      sourceTicketId: existingTicket.id,
      targetTicketId: ticketId,
    });
    return { action: "linked_created", ticketId };
  }

  return { action: "created", ticketId };
}
