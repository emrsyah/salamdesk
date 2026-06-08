import { db } from "@/db";
import { ticketLinks } from "@/db/schema/tickets";

export async function createTicketLink(data: typeof ticketLinks.$inferInsert) {
  const [link] = await db.insert(ticketLinks).values(data).returning();
  return link;
}
