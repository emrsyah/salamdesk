"use server";

import { db } from "@/db";
import { ticketReads } from "@/db/schema/ticket-reads";
import { getSession } from "@/lib/auth/session";

/**
 * Upsert the current user's read cursor for a ticket to "now". Called when the
 * user opens a ticket (and again if a new message lands while it's open), which
 * clears the inbox unread indicator for them. Per-user, so reading does not
 * affect anyone else's unread state.
 */
export async function markTicketReadAction(
  ticketId: string,
): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session?.user) return { ok: false };

  const now = new Date();
  await db
    .insert(ticketReads)
    .values({ userId: session.user.id, ticketId, lastReadAt: now })
    .onConflictDoUpdate({
      target: [ticketReads.userId, ticketReads.ticketId],
      set: { lastReadAt: now },
    });

  return { ok: true };
}
