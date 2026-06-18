import { db } from "@/db";
import { tickets, ticketMessages, ticketEscalations } from "@/db/schema/tickets";
import { aiSuggestions } from "@/db/schema/knowledge-base";
import { triageEvents } from "@/db/schema/triage";
import { eq, and, desc, asc, inArray, isNull, isNotNull } from "drizzle-orm";
import crypto from "node:crypto";
import { getSlaDeadlines } from "./ticket-sla.service";
import {
  assignTicketWithLifecycle,
  resolveTicketWithLifecycle,
  transitionTicketStatus,
} from "./ticket-lifecycle.service";

export type TicketPriority = "low" | "medium" | "critical";
export type TicketSource = "whatsapp" | "web" | "email" | "manual" | "api";

const TICKETS_WITH = {
  module: { columns: { id: true, name: true, color: true } },
  requester: {
    columns: {
      id: true,
      displayName: true,
      fullName: true,
      primaryPhone: true,
      primaryEmail: true,
      departmentId: true,
    },
    with: { department: { columns: { id: true, name: true } } },
  },
  createdBy: { columns: { id: true, name: true, email: true } },
  assignee: { columns: { id: true, name: true } },
} as const;

const NEVER_MATCHING_MODULE_ID = "00000000-0000-0000-0000-000000000000";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
        if (ctx.role === "operator" && ctx.moduleIds) {
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
          conditions.push(
            eq(
              tickets.moduleId,
              UUID_PATTERN.test(ctx.filters.module)
                ? ctx.filters.module
                : NEVER_MATCHING_MODULE_ID,
            ),
          );
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
  
  // Extra safety for operators with no modules
  if (ctx?.role === "operator" && (!ctx.moduleIds || ctx.moduleIds.length === 0)) {
    return [];
  }

  return results;
}

export async function getTicketById(id: string) {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, id),
    with: {
      module: true,
      requester: {
        with: {
          department: { columns: { id: true, name: true } },
          identities: {
            columns: {
              id: true,
              channel: true,
              identifier: true,
              displayName: true,
              lastSeenAt: true,
            },
          },
        },
      },
      createdBy: { columns: { id: true, name: true, email: true } },
      assignee: { columns: { id: true, name: true } },
      messages: {
        with: {
          sender: { columns: { id: true, name: true } },
          requester: { columns: { id: true, displayName: true } },
          attachments: {
            columns: {
              id: true,
              fileName: true,
              fileUrl: true,
              mimeType: true,
              fileSize: true,
            },
          },
        },
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
      triageEvents: {
        columns: {
          replyConfidence: true,
          suggestedReply: true,
          suggestedKbId: true,
          suggestedKbTitle: true,
          autoReplySent: true,
          createdAt: true,
        },
        orderBy: [asc(triageEvents.createdAt)],
      },
    },
  });

  if (!ticket) return ticket;

  // Correlate each AI-sent message with the triage event that produced it, so the
  // UI can show why the AI replied (confidence + KB used). Match on identical
  // reply text first; fall back to the nearest event by timestamp.
  const aiEvents = ticket.triageEvents.filter(
    (e) => e.autoReplySent && e.suggestedReply,
  );

  const messages = ticket.messages.map((msg) => {
    if (msg.senderType !== "ai_agent") return msg;
    const match =
      aiEvents.find((e) => e.suggestedReply?.trim() === msg.content.trim()) ??
      nearestEventByTime(aiEvents, msg.createdAt);
    if (!match) return msg;
    return {
      ...msg,
      aiMeta: {
        replyConfidence: match.replyConfidence != null ? Number(match.replyConfidence) : null,
        kbId: match.suggestedKbId,
        kbTitle: match.suggestedKbTitle,
      },
    };
  });

  return { ...ticket, messages };
}

type AiTriageEvent = {
  replyConfidence: string | null;
  suggestedReply: string | null;
  suggestedKbId: string | null;
  suggestedKbTitle: string | null;
  autoReplySent: boolean;
  createdAt: Date;
};

/** Pick the triage event closest in time to a message (used when the reply text was edited). */
function nearestEventByTime(events: AiTriageEvent[], when: Date) {
  let best: AiTriageEvent | null = null;
  let bestDelta = Infinity;
  for (const event of events) {
    const delta = Math.abs(event.createdAt.getTime() - when.getTime());
    if (delta < bestDelta) {
      best = event;
      bestDelta = delta;
    }
  }
  return best;
}

export async function createTicket(data: {
  title: string;
  description: string;
  moduleId?: string | null;
  priority: TicketPriority;
  source: TicketSource;
  requesterId?: string | null;
  openedByStaffId?: string | null;
  createdById?: string | null;
  waPhone?: string | null;
}) {
  const createdAt = new Date();
  const { firstResponseDueAt, resolutionDueAt } = await getSlaDeadlines({
    moduleId: data.moduleId,
    priority: data.priority,
    createdAt,
  });
  const id = crypto.randomUUID();

  await db.insert(tickets).values({
    id,
    title: data.title,
    description: data.description || null,
    status: "open",
    priority: data.priority,
    slaStatus: "safe",
    slaDeadlineAt: resolutionDueAt,
    firstResponseDueAt,
    resolutionDueAt,
    moduleId: data.moduleId ?? null,
    requesterId: data.requesterId ?? null,
    waPhone: data.waPhone ?? null,
    source: data.source,
    createdById: data.createdById ?? null,
    openedByStaffId: data.openedByStaffId ?? null,
    createdAt,
  }).execute();

  if (data.description) {
    await db.insert(ticketMessages).values({
      ticketId: id,
      senderId: data.openedByStaffId ?? null,
      requesterId: data.requesterId ?? null,
      senderType: data.requesterId ? "requester" : "staff",
      content: data.description,
      isInternalNote: false,
      source: data.source,
    }).execute();
  }

  return { id };
}

export async function updateTicketStatus(
  id: string,
  status: "open" | "in_progress" | "resolved" | "closed",
) {
  await transitionTicketStatus({
    ticketId: id,
    toStatus: status,
    actorId: null,
    actorType: "system",
    note: "Legacy status update compatibility path",
  });
}

export async function assignTicket(id: string, assigneeId: string | null) {
  await assignTicketWithLifecycle({
    ticketId: id,
    assigneeId,
    actorId: assigneeId ?? "system",
  });
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
  await resolveTicketWithLifecycle({
    ticketId: id,
    actorId: data.resolvedById ?? "system",
    resolutionNote: data.resolutionNote ?? "",
    rootCause: data.rootCause ?? null,
    resolvedKbIds: data.resolvedKbIds ?? null,
  });
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
    await tx.insert(ticketEscalations).values({
      ticketId,
      escalatedFromId: data.fromId,
      escalatedToId: data.toId,
      reason: data.reason,
    });
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

export async function findLatestTicketByWaPhone(phone: string) {
  return db.query.tickets.findFirst({
    where: eq(tickets.waPhone, phone),
    orderBy: [desc(tickets.createdAt)],
    columns: {
      id: true,
      status: true,
      assigneeId: true,
      autoCloseDueAt: true,
      waPhone: true,
    },
  });
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
