import { db } from "@/db";
import { eq } from "drizzle-orm";
import { waOutboundQueue, type WaOutboundJob } from "@/lib/queue";
import crypto from "node:crypto";
import { user } from "auth-schema";

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
export async function findOrCreateReporterByPhone(
  phone: string,
  pushName: string | null,
): Promise<string> {
  // Look up by phone first
  const existing = await db.query.users.findFirst({
    where: eq(user.phone, phone),
    columns: { id: true },
  });

  if (existing) return existing.id;

  // Create a synthetic reporter account
  const id = crypto.randomUUID();
  const syntheticEmail = `${phone}@wa.salamdesk.local`;
  const name = pushName?.trim() || phone;

  await db.insert(user).values({
    id,
    name,
    email: syntheticEmail,
    emailVerified: false,
    phone,
    role: "reporter",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return id;
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
