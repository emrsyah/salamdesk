import { db } from "@/db";
import { tickets, ticketMessages, ticketEscalations } from "@/db/schema/tickets";
import { aiSuggestions } from "@/db/schema/knowledge-base";
import { slaConfigs } from "@/db/schema/modules";
import { eq, and, desc, asc, inArray, isNull, isNotNull } from "drizzle-orm";
import crypto from "node:crypto";

export type TicketPriority = "low" | "medium" | "critical";
export type TicketSource = "whatsapp" | "web" | "email" | "manual";

const TICKETS_WITH = {
  module: { columns: { id: true, name: true, color: true } },
  createdBy: { columns: { id: true, name: true, email: true } },
  assignee: { columns: { id: true, name: true } },
} as const;

type TicketContext = {
  userId: string;
  role: string;
  moduleIds?: string[];
  filters?: {
    assignee?: string;
    priority?: string;
    sla?: string;
    module?: string;
    status?: string;
    resolvedBy?: string;
  };
};

export async function getTickets(ctx?: TicketContext) {
  const query = db.query.tickets.findMany({
    with: TICKETS_WITH,
    orderBy: [desc(tickets.createdAt)],
    where: (tickets, { and, eq, inArray, or }) => {
      const conditions = [];

      // Base Role-based Access
      if (ctx) {
        if (ctx.role === "reporter") {
          conditions.push(eq(tickets.createdById, ctx.userId));
        } else if (ctx.role === "agent" && ctx.moduleIds) {
          if (ctx.moduleIds.length === 0) return undefined; // Should return nothing, handled by return [] below if no conditions
          conditions.push(inArray(tickets.moduleId, ctx.moduleIds));
        } else if (ctx.role === "engineer") {
          conditions.push(eq(tickets.assigneeId, ctx.userId));
        }
      }

      // Dynamic Filters
      if (ctx?.filters) {
        if (ctx.filters.assignee === "me") {
          conditions.push(eq(tickets.assigneeId, ctx.userId));
        } else if (ctx.filters.assignee) {
          conditions.push(eq(tickets.assigneeId, ctx.filters.assignee));
        }

        if (ctx.filters.priority) {
          conditions.push(eq(tickets.priority, ctx.filters.priority as any));
        }

        if (ctx.filters.module) {
          conditions.push(eq(tickets.moduleId, ctx.filters.module));
        }

        if (ctx.filters.status) {
          conditions.push(eq(tickets.status, ctx.filters.status as any));
        }

        if (ctx.filters.resolvedBy === "ai") {
          conditions.push(eq(tickets.resolvedByType, "ai"));
        }

        if (ctx.filters.sla === "breached") {
          conditions.push(eq(tickets.slaStatus, "breached"));
        }
      }

      return conditions.length > 0 ? and(...conditions) : undefined;
    },
  });

  const results = await query;
  
  // Extra safety for agent with no modules
  if (ctx?.role === "agent" && (!ctx.moduleIds || ctx.moduleIds.length === 0)) {
    return [];
  }

  return results;
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
      aiSuggestions: {
        with: {
          knowledgeBase: {
            columns: { id: true, title: true, content: true },
          },
        },
        orderBy: [desc(aiSuggestions.createdAt)],
        limit: 1,
      },
    },
  });
}

export async function createTicket(data: {
  title: string;
  description: string;
  moduleId?: string | null;
  priority: TicketPriority;
  source: TicketSource;
  createdById?: string;
  waPhone?: string | null;
}) {
  let slaDeadlineAt: Date | null = null;

  if (data.moduleId) {
    const slaConfig = await db.query.slaConfigs.findFirst({
      where: and(
        eq(slaConfigs.moduleId, data.moduleId),
        eq(slaConfigs.priority, data.priority),
        eq(slaConfigs.isActive, true),
      ),
    });
    if (slaConfig) {
      const now = new Date();
      slaDeadlineAt = new Date(now.getTime() + slaConfig.resolutionTimeMinutes * 60 * 1000);
    }
  }

  const id = crypto.randomUUID();

  await db.insert(tickets).values({
    id,
    title: data.title,
    description: data.description || null,
    status: "open",
    priority: data.priority,
    slaStatus: "safe",
    slaDeadlineAt,
    moduleId: data.moduleId ?? null,
    waPhone: data.waPhone ?? null,
    source: data.source,
    createdById: data.createdById ?? null,
  }).execute();

  if (data.description) {
    await db.insert(ticketMessages).values({
      ticketId: id,
      senderId: data.createdById ?? null,
      senderType: "user",
      content: data.description,
      isInternalNote: false,
      source: data.source,
    }).execute();
  }

  return { id };
}

export async function updateTicketStatus(id: string, status: any) {
  await db
    .update(tickets)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, id))
    .execute();
}

export async function assignTicket(id: string, assigneeId: string | null) {
  await db
    .update(tickets)
    .set({
      assigneeId,
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, id))
    .execute();
}

export async function resolveTicket(
  id: string,
  data: {
    resolutionNote?: string;
    rootCause?: any;
    resolvedById?: string;
    resolvedKbIds?: string[];
  }
) {
  await db
    .update(tickets)
    .set({
      status: "resolved",
      resolutionNote: data.resolutionNote || null,
      rootCause: data.rootCause || null,
      resolvedById: data.resolvedById || null,
      resolvedKbIds: data.resolvedKbIds || null,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, id))
    .execute();
}

export async function escalateTicket(
  ticketId: string,
  data: {
    fromId: string;
    toId: string | null;
    reason: string;
  }
) {
  await db.transaction(async (tx) => {
    // Insert escalation record
    await tx.insert(ticketEscalations).values({
      ticketId,
      escalatedFromId: data.fromId,
      escalatedToId: data.toId,
      reason: data.reason,
    });

    // Update ticket status and assignee
    await tx
      .update(tickets)
      .set({
        status: "in_progress",
        assigneeId: data.toId,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticketId));
  });
}

/**
 * Find the most recent active (non-terminal) ticket for a WhatsApp phone number.
 * Used by the bot worker to decide whether to append or create a new ticket.
 * Terminal statuses: "resolved" | "closed"
 */
export async function findOpenTicketByWaPhone(phone: string) {
  const results = await db.query.tickets.findMany({
    where: eq(tickets.waPhone, phone),
    orderBy: [desc(tickets.createdAt)],
    columns: { id: true, status: true, waPhone: true },
    limit: 1,
  });

  const ticket = results[0];
  if (!ticket) return null;

  // Only return if the ticket is still active
  if (ticket.status === "resolved" || ticket.status === "closed") return null;

  return ticket;
}


/**
 * Get a ticket's source and waPhone for outbound reply routing.
 */
export async function getTicketForWaReply(ticketId: string) {
  return db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: {
      id: true,
      source: true,
      waPhone: true,
    },
  });
}
