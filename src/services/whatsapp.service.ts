import { waOutboundQueue, type WaOutboundJob } from "@/lib/queue";
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
 * Called by messages.actions.ts when an agent replies to a WA-sourced ticket.
 */
export async function sendWhatsAppMessage(
  phone: string,
  text: string,
): Promise<void> {
  const job: WaOutboundJob = { phone, text };
  await waOutboundQueue.add("send", job);
}
