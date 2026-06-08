import { db } from "@/db";
import { ticketEvents } from "@/db/schema/tickets";

type TicketEventInput = typeof ticketEvents.$inferInsert;

export async function recordTicketEvent(data: TicketEventInput) {
  const [event] = await db.insert(ticketEvents).values(data).returning();
  return event;
}

export async function recordTicketEvents(events: TicketEventInput[]) {
  if (events.length === 0) return [];
  return db.insert(ticketEvents).values(events).returning();
}
