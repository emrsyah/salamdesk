import { waOutboundQueue, type WaOutboundAttachment, type WaOutboundJob } from "@/lib/queue";
import { findOrCreateRequesterByIdentity } from "@/services/requester.service";

/**
 * Normalises a WhatsApp JID like "6281234567890@s.whatsapp.net"
 * to just the phone number "6281234567890".
 */
export function normalisePhone(jid: string): string {
  return jid.split("@")[0].split(":")[0];
}

/**
 * Find an existing user by phone number, or auto-create a reporter account.
 *
 * Auto-created users:
 *  - email: <phone>@wa.salamdesk.local (synthetic, not used for login)
 *  - name:  WhatsApp pushName or phone number as fallback
 *  - role:  reporter
 *  - phone: the normalised phone string
 *
 * They cannot log in via web — they exist only as a DB reference for tickets.
 */
export async function findOrCreateRequesterByPhone(
  phone: string,
  pushName: string | null,
): Promise<string> {
  return findOrCreateRequesterByIdentity("whatsapp", phone, {
    displayName: pushName,
    phone,
  });
}

/**
 * Enqueue an outbound WhatsApp message.
 * Called when an agent (or AI) replies to a WA-sourced ticket.
 *
 * `jid` is the full WhatsApp addressing JID stored on the ticket
 * (tickets.waPhone), e.g. "6281234567890@s.whatsapp.net" or "<id>@lid".
 * The worker passes it straight to sock.sendMessage() — do not append a domain.
 */
export async function sendWhatsAppMessage(
  jid: string,
  text: string,
  options?: { attachments?: WaOutboundAttachment[]; typing?: boolean },
): Promise<void> {
  const job: WaOutboundJob = {
    jid,
    text,
    attachments: options?.attachments,
    typing: options?.typing,
  };
  await waOutboundQueue.add("send", job);
}
