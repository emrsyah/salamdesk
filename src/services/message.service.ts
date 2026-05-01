import { db } from "@/db";
import { ticketMessages } from "@/db/schema/tickets";
import { eq, asc } from "drizzle-orm";

export async function getTicketMessages(ticketId: string) {
  return db.query.ticketMessages.findMany({
    where: eq(ticketMessages.ticketId, ticketId),
    with: {
      sender: {
        columns: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
    orderBy: [asc(ticketMessages.createdAt)],
  });
}

export async function createMessage(data: {
  ticketId: string;
  senderId: string | null;
  senderType: "user" | "ai_bot";
  content: string;
  isInternalNote: boolean;
  source?: "whatsapp" | "web" | "email" | "manual";
}) {
  return db.insert(ticketMessages).values({
    ticketId: data.ticketId,
    senderId: data.senderId,
    senderType: data.senderType,
    content: data.content,
    isInternalNote: data.isInternalNote,
    source: data.source || "web",
  }).execute();
}
