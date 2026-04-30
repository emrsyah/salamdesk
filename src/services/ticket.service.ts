import { db } from "@/db";
import { tickets, ticketMessages } from "@/db/schema/tickets";
import { slaConfigs } from "@/db/schema/modules";
import { eq, and, desc, asc } from "drizzle-orm";
import crypto from "node:crypto";

export type TicketPriority = "low" | "medium" | "critical";
export type TicketSource = "whatsapp" | "web" | "email" | "manual";

export async function getTickets() {
  return db.query.tickets.findMany({
    with: {
      module: { columns: { id: true, name: true, color: true } },
      createdBy: { columns: { id: true, name: true } },
      assignee: { columns: { id: true, name: true } },
    },
    orderBy: [desc(tickets.createdAt)],
  });
}

export async function getTicketById(id: string) {
  return db.query.tickets.findFirst({
    where: eq(tickets.id, id),
    with: {
      module: true,
      createdBy: { columns: { id: true, name: true, email: true } },
      assignee: { columns: { id: true, name: true } },
      messages: {
        with: { sender: { columns: { id: true, name: true } } },
        orderBy: [asc(ticketMessages.createdAt)],
      },
    },
  });
}

export async function createTicket(data: {
  title: string;
  description: string;
  moduleId: string;
  priority: TicketPriority;
  source: TicketSource;
  createdById?: string;
}) {
  const slaConfig = await db.query.slaConfigs.findFirst({
    where: and(
      eq(slaConfigs.moduleId, data.moduleId),
      eq(slaConfigs.priority, data.priority),
      eq(slaConfigs.isActive, true),
    ),
  });

  const now = new Date();
  const slaDeadlineAt = slaConfig
    ? new Date(now.getTime() + slaConfig.resolutionTimeMinutes * 60 * 1000)
    : null;

  const id = crypto.randomUUID();

  await db.insert(tickets).values({
    id,
    title: data.title,
    description: data.description || null,
    status: "open",
    priority: data.priority,
    slaStatus: "safe",
    slaDeadlineAt,
    moduleId: data.moduleId,
    source: data.source,
    createdById: data.createdById ?? null,
  });

  if (data.description) {
    await db.insert(ticketMessages).values({
      ticketId: id,
      senderId: data.createdById ?? null,
      senderType: "user",
      content: data.description,
      isInternalNote: false,
      source: data.source,
    });
  }

  return { id };
}
