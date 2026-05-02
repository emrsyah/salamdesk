import { findOrCreateReporterByPhone } from "@/services/whatsapp.service";
import {
  findOpenTicketByWaPhone,
  createTicket,
} from "@/services/ticket.service";
import { createMessage } from "@/services/message.service";
import { aiTriageQueue } from "@/lib/queue";
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
  action: "created" | "appended";
  ticketId: string;
}> {
  const { phone, text, pushName } = job;

  // 1. Resolve or create the reporter user
  const reporterId = await findOrCreateReporterByPhone(phone, pushName);

  // 2. Find an active ticket for this phone
  const existingTicket = await findOpenTicketByWaPhone(phone);

  if (existingTicket) {
    // Append to the existing conversation thread
    await createMessage({
      ticketId: existingTicket.id,
      senderId: reporterId,
      senderType: "user",
      content: text,
      isInternalNote: false,
      source: "whatsapp",
    });

    console.log(
      `[BOT] Appended message to ticket ${existingTicket.id} from ${phone}`,
    );

    return { action: "appended", ticketId: existingTicket.id };
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
    createdById: reporterId,
    waPhone: phone,
  });

  console.log(`[BOT] Created ticket ${ticketId} for ${phone} (${pushName ?? "unknown"})`);

  // Enqueue AI triage — classifies module, priority, and searches KB
  await aiTriageQueue.add("triage", { ticketId });
  console.log(`[BOT] Enqueued AI triage for ticket ${ticketId}`);

  return { action: "created", ticketId };
}
