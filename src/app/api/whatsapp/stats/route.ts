import { NextResponse } from "next/server";
import { and, count, eq, gte, inArray, max } from "drizzle-orm";
import { db } from "@/db";
import { tickets, ticketMessages } from "@/db/schema/tickets";
import { requesterIdentities } from "@/db/schema/requesters";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    [ticketsTotal],
    [ticketsOpen],
    [ticketsToday],
    [contacts],
    [messagesToday],
    [lastInbound],
  ] = await Promise.all([
    db.select({ value: count() }).from(tickets).where(eq(tickets.source, "whatsapp")),
    db
      .select({ value: count() })
      .from(tickets)
      .where(
        and(
          eq(tickets.source, "whatsapp"),
          inArray(tickets.status, ["open", "in_progress", "waiting"]),
        ),
      ),
    db
      .select({ value: count() })
      .from(tickets)
      .where(and(eq(tickets.source, "whatsapp"), gte(tickets.createdAt, startOfToday))),
    db
      .select({ value: count() })
      .from(requesterIdentities)
      .where(eq(requesterIdentities.channel, "whatsapp")),
    db
      .select({ value: count() })
      .from(ticketMessages)
      .where(
        and(
          eq(ticketMessages.source, "whatsapp"),
          eq(ticketMessages.senderType, "requester"),
          gte(ticketMessages.createdAt, startOfToday),
        ),
      ),
    db
      .select({ value: max(ticketMessages.createdAt) })
      .from(ticketMessages)
      .where(
        and(eq(ticketMessages.source, "whatsapp"), eq(ticketMessages.senderType, "requester")),
      ),
  ]);

  return NextResponse.json({
    ticketsTotal: ticketsTotal.value,
    ticketsOpen: ticketsOpen.value,
    ticketsToday: ticketsToday.value,
    contacts: contacts.value,
    messagesToday: messagesToday.value,
    lastInboundAt: lastInbound.value ?? null,
  });
}
