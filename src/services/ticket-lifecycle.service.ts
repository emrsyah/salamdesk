import { db } from "@/db";
import {
  ticketEscalations,
  ticketEvents,
  ticketLinks,
  ticketMessageAttachments,
  ticketMessages,
  tickets,
} from "@/db/schema/tickets";
import { and, desc, eq, inArray } from "drizzle-orm";
import { sendWhatsAppMessage } from "./whatsapp.service";
import { publishTicketEvent } from "@/lib/realtime";
import { getSlaDeadlines } from "./ticket-sla.service";
import {
  canTransitionTicketStatus,
  normalizeTicketStatus,
  type TargetTicketStatus,
} from "./ticket-lifecycle.types";
import type { TicketPriority, TicketSource } from "./ticket.service";

type LifecycleActorType = "staff" | "system" | "requester";
type StaffRole = "owner" | "admin" | "supervisor" | "operator" | "engineer";

export type TicketLifecycleActor =
  | {
      type: "staff";
      id: string;
      role: StaffRole;
      moduleIds: string[];
    }
  | { type: "requester"; requesterId: string | null }
  | { type: "system" }
  | { type: "external_api"; apiKeyId?: string | null };

export type MessageAttachmentInput = {
  fileName: string;
  fileUrl: string;
  storageKey: string;
  mimeType: string;
  fileSize?: number | null;
};

export class TicketLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketLifecycleError";
  }
}

const GLOBAL_STAFF_ROLES: StaffRole[] = ["owner", "admin", "supervisor"];

type TicketPermissionSubject = Pick<
  typeof tickets.$inferSelect,
  "assigneeId" | "moduleId" | "status"
>;

function isGlobalStaff(actor: Extract<TicketLifecycleActor, { type: "staff" }>) {
  return GLOBAL_STAFF_ROLES.includes(actor.role);
}

function isSameModuleStaff(
  actor: Extract<TicketLifecycleActor, { type: "staff" }>,
  ticket: TicketPermissionSubject,
) {
  return !!ticket.moduleId && actor.moduleIds.includes(ticket.moduleId);
}

function assertStaffCanAct(
  actor: TicketLifecycleActor,
  ticket: TicketPermissionSubject,
  action: "reply" | "configure" | "escalate" | "resolve" | "reopen" | "close",
) {
  if (actor.type !== "staff") {
    throw new TicketLifecycleError("Only staff can perform this ticket action.");
  }

  if (isGlobalStaff(actor)) return;
  if (ticket.assigneeId === actor.id) return;

  const sameModule = isSameModuleStaff(actor, ticket);
  if (sameModule && (action === "reply" || action === "escalate")) return;

  if (sameModule && action === "configure" && !ticket.assigneeId) return;

  throw new TicketLifecycleError("You are not allowed to perform this ticket action.");
}

function assignmentEventType(input: {
  fromAssigneeId: string | null;
  toAssigneeId: string | null;
  actorId: string;
}) {
  if (!input.toAssigneeId) return "unassigned";
  if (!input.fromAssigneeId) return "assigned";
  if (input.fromAssigneeId !== input.toAssigneeId) {
    return input.toAssigneeId === input.actorId ? "takeover" : "reassigned";
  }
  return "assigned";
}

export async function addStaffReplyCommand(input: {
  ticketId: string;
  actor: TicketLifecycleActor;
  content: string;
  visibility: "public" | "internal";
  source?: TicketSource;
  attachments?: MessageAttachmentInput[];
}) {
  const content = input.content.trim();
  const attachments = input.attachments ?? [];
  if (!content && attachments.length === 0) {
    throw new TicketLifecycleError("Message content or an attachment is required.");
  }

  const delivery = await db.transaction(async (tx) => {
    const ticket = await tx.query.tickets.findFirst({
      where: eq(tickets.id, input.ticketId),
      columns: {
        id: true,
        status: true,
        assigneeId: true,
        moduleId: true,
        source: true,
        waPhone: true,
        firstRespondedAt: true,
      },
    });
    if (!ticket) throw new TicketLifecycleError("Ticket not found.");
    if (ticket.status === "closed") {
      throw new TicketLifecycleError("Closed tickets cannot receive messages.");
    }

    assertStaffCanAct(input.actor, ticket, "reply");

    const staffId = input.actor.type === "staff" ? input.actor.id : null;
    if (!staffId) throw new TicketLifecycleError("Staff actor is required.");

    const isInternalNote = input.visibility === "internal";
    const [message] = await tx
      .insert(ticketMessages)
      .values({
        ticketId: input.ticketId,
        senderId: staffId,
        senderType: "staff",
        // An attachment-only message has empty text — store a single space so
        // the NOT NULL `content` column is satisfied and the thread renders.
        content: content || " ",
        isInternalNote,
        source: input.source ?? "web",
      })
      .returning();

    if (attachments.length > 0) {
      await tx.insert(ticketMessageAttachments).values(
        attachments.map((attachment) => ({
          messageId: message.id,
          fileName: attachment.fileName,
          fileUrl: attachment.fileUrl,
          storageKey: attachment.storageKey,
          mimeType: attachment.mimeType,
          fileSize: attachment.fileSize ?? null,
        })),
      );
    }

    if (!isInternalNote) {
      const now = new Date();
      const updates: Partial<typeof tickets.$inferInsert> = {
        updatedAt: now,
      };

      if (ticket.status === "open" && !ticket.assigneeId) {
        updates.status = "in_progress";
        updates.assigneeId = staffId;
      }

      if (!ticket.firstRespondedAt) {
        updates.firstRespondedAt = now;
        updates.firstRespondedById = staffId;
        updates.firstResponseSlaStatus = "safe";
      }

      await tx.update(tickets).set(updates).where(eq(tickets.id, input.ticketId));
    }

    return {
      message,
      outboundWhatsApp:
        !isInternalNote && ticket.source === "whatsapp" && ticket.waPhone
          ? {
              jid: ticket.waPhone,
              text: content,
              attachments: attachments.map((attachment) => ({
                url: attachment.fileUrl,
                fileName: attachment.fileName,
                mimeType: attachment.mimeType,
              })),
            }
          : null,
    };
  });

  if (delivery.outboundWhatsApp) {
    await sendWhatsAppMessage(delivery.outboundWhatsApp.jid, delivery.outboundWhatsApp.text, {
      attachments: delivery.outboundWhatsApp.attachments,
    });
  }

  return delivery.message;
}

export async function configureTicketCommand(input: {
  ticketId: string;
  actor: TicketLifecycleActor;
  moduleId?: string | null;
  assigneeId?: string | null;
  priority?: TicketPriority;
}) {
  return db.transaction(async (tx) => {
    const ticket = await tx.query.tickets.findFirst({
      where: eq(tickets.id, input.ticketId),
    });
    if (!ticket) throw new TicketLifecycleError("Ticket not found.");
    if (ticket.status === "closed" || ticket.status === "resolved") {
      throw new TicketLifecycleError("Only active tickets can be configured.");
    }

    assertStaffCanAct(input.actor, ticket, "configure");

    const staffId = input.actor.type === "staff" ? input.actor.id : null;
    if (!staffId) throw new TicketLifecycleError("Staff actor is required.");

    const toModuleId = input.moduleId === undefined ? ticket.moduleId : input.moduleId;
    const toAssigneeId =
      input.assigneeId === undefined ? ticket.assigneeId : input.assigneeId;
    const toPriority = input.priority ?? ticket.priority;
    const moduleChanged = toModuleId !== ticket.moduleId;
    const assigneeChanged = toAssigneeId !== ticket.assigneeId;
    const priorityChanged = toPriority !== ticket.priority;

    if (!moduleChanged && !assigneeChanged && !priorityChanged) {
      return ticket;
    }

    const fromStatus = normalizeTicketStatus(ticket.status, ticket.assigneeId);
    const toStatus =
      moduleChanged || assigneeChanged
        ? toAssigneeId
          ? "in_progress"
          : "open"
        : fromStatus;

    // Recalculate SLA deadlines when module or priority changes.
    // Tickets from WhatsApp start with moduleId=null → no SLA. When a staff
    // member (or AI triage) sets a module for the first time, we back-fill the
    // SLA deadlines from the ticket's original createdAt.
    let slaFields: Partial<typeof tickets.$inferInsert> = {};
    if (moduleChanged || priorityChanged) {
      const effectiveModuleId = toModuleId ?? null;
      if (effectiveModuleId) {
        const { firstResponseDueAt, resolutionDueAt } = await getSlaDeadlines({
          moduleId: effectiveModuleId,
          priority: toPriority,
          createdAt: ticket.createdAt,
        });
        if (firstResponseDueAt && resolutionDueAt) {
          slaFields = {
            firstResponseDueAt,
            resolutionDueAt,
            slaDeadlineAt: resolutionDueAt,
          };
        }
      }
    }

    const [updated] = await tx
      .update(tickets)
      .set({
        moduleId: toModuleId,
        assigneeId: toAssigneeId,
        priority: toPriority,
        status: toStatus,
        updatedAt: new Date(),
        ...slaFields,
      })
      .where(eq(tickets.id, input.ticketId))
      .returning();

    const events: (typeof ticketEvents.$inferInsert)[] = [];

    if (moduleChanged) {
      events.push({
        ticketId: input.ticketId,
        type: "module_changed",
        actorId: staffId,
        actorType: "staff",
        fromStatus,
        toStatus,
        fromAssigneeId: ticket.assigneeId,
        toAssigneeId,
        fromModuleId: ticket.moduleId,
        toModuleId,
      });
    }

    if (assigneeChanged) {
      events.push({
        ticketId: input.ticketId,
        type: assignmentEventType({
          fromAssigneeId: ticket.assigneeId,
          toAssigneeId,
          actorId: staffId,
        }),
        actorId: staffId,
        actorType: "staff",
        fromStatus,
        toStatus,
        fromAssigneeId: ticket.assigneeId,
        toAssigneeId,
      });
    }

    if (priorityChanged) {
      events.push({
        ticketId: input.ticketId,
        type: "priority_changed",
        actorId: staffId,
        actorType: "staff",
        fromStatus,
        toStatus,
        fromPriority: ticket.priority,
        toPriority,
      });
    }

    if (events.length > 0) {
      await tx.insert(ticketEvents).values(events);
    }

    return updated;
  });
}

export async function escalateTicketCommand(input: {
  ticketId: string;
  actor: TicketLifecycleActor;
  engineerId: string | null;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason) {
    throw new TicketLifecycleError("Escalation reason is required.");
  }

  return db.transaction(async (tx) => {
    const ticket = await tx.query.tickets.findFirst({
      where: eq(tickets.id, input.ticketId),
    });
    if (!ticket) throw new TicketLifecycleError("Ticket not found.");
    if (ticket.status === "closed" || ticket.status === "resolved") {
      throw new TicketLifecycleError("Only active tickets can be escalated.");
    }

    assertStaffCanAct(input.actor, ticket, "escalate");

    const staffId = input.actor.type === "staff" ? input.actor.id : null;
    if (!staffId) throw new TicketLifecycleError("Staff actor is required.");

    await tx.insert(ticketEscalations).values({
      ticketId: input.ticketId,
      escalatedFromId: staffId,
      escalatedToId: input.engineerId,
      reason,
    });

    if (!input.engineerId || input.engineerId === ticket.assigneeId) {
      return ticket;
    }

    const fromStatus = normalizeTicketStatus(ticket.status, ticket.assigneeId);
    const toStatus: TargetTicketStatus = "in_progress";
    const [updated] = await tx
      .update(tickets)
      .set({
        assigneeId: input.engineerId,
        status: toStatus,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, input.ticketId))
      .returning();

    await tx.insert(ticketEvents).values({
      ticketId: input.ticketId,
      type: assignmentEventType({
        fromAssigneeId: ticket.assigneeId,
        toAssigneeId: input.engineerId,
        actorId: staffId,
      }),
      actorId: staffId,
      actorType: "staff",
      fromStatus,
      toStatus,
      fromAssigneeId: ticket.assigneeId,
      toAssigneeId: input.engineerId,
    });

    return updated;
  });
}

export async function addSystemUpdateCommand(input: {
  ticketId: string;
  content: string;
  source?: TicketSource;
}) {
  const content = input.content.trim();
  if (!content) {
    throw new TicketLifecycleError("Message content is required.");
  }

  return db.transaction(async (tx) => {
    const ticket = await tx.query.tickets.findFirst({
      where: eq(tickets.id, input.ticketId),
      columns: { id: true, status: true },
    });
    if (!ticket) throw new TicketLifecycleError("Ticket not found.");
    if (ticket.status === "closed") {
      throw new TicketLifecycleError("Closed tickets cannot receive updates.");
    }

    const [message] = await tx
      .insert(ticketMessages)
      .values({
        ticketId: input.ticketId,
        senderId: null,
        senderType: "system",
        content,
        isInternalNote: false,
        source: input.source ?? "api",
      })
      .returning();

    await tx
      .update(tickets)
      .set({ updatedAt: new Date() })
      .where(eq(tickets.id, input.ticketId));

    return message;
  });
}

export async function transitionTicketStatus(input: {
  ticketId: string;
  toStatus: TargetTicketStatus;
  actorId: string | null;
  actorType: LifecycleActorType;
  note?: string;
}) {
  return db.transaction(async (tx) => {
    const ticket = await tx.query.tickets.findFirst({
      where: eq(tickets.id, input.ticketId),
    });
    if (!ticket) throw new TicketLifecycleError("Ticket not found.");

    if (
      !canTransitionTicketStatus(ticket.status, input.toStatus, ticket.assigneeId)
    ) {
      throw new TicketLifecycleError(
        `Cannot move ticket from ${ticket.status} to ${input.toStatus}.`,
      );
    }

    const normalizedFrom = normalizeTicketStatus(ticket.status, ticket.assigneeId);
    const [updated] = await tx
      .update(tickets)
      .set({
        status: input.toStatus,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, input.ticketId))
      .returning();

    await tx.insert(ticketEvents).values({
      ticketId: input.ticketId,
      type: "status_changed",
      actorId: input.actorId,
      actorType: input.actorType,
      fromStatus: normalizedFrom,
      toStatus: input.toStatus,
      note: input.note,
    });

    return updated;
  });
}

export async function assignTicketWithLifecycle(input: {
  ticketId: string;
  assigneeId: string | null;
  actorId: string;
  isTakeover?: boolean;
}) {
  return db.transaction(async (tx) => {
    const ticket = await tx.query.tickets.findFirst({
      where: eq(tickets.id, input.ticketId),
    });
    if (!ticket) throw new TicketLifecycleError("Ticket not found.");
    if (ticket.status === "closed") {
      throw new TicketLifecycleError("Closed tickets cannot be assigned.");
    }

    const fromStatus = normalizeTicketStatus(ticket.status, ticket.assigneeId);
    const toStatus = input.assigneeId ? "in_progress" : "open";
    const eventType =
      input.assigneeId === null
        ? "unassigned"
        : ticket.assigneeId && ticket.assigneeId !== input.assigneeId
          ? input.isTakeover
            ? "takeover"
            : "reassigned"
          : "assigned";

    const [updated] = await tx
      .update(tickets)
      .set({
        assigneeId: input.assigneeId,
        status: toStatus,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, input.ticketId))
      .returning();

    await tx.insert(ticketEvents).values({
      ticketId: input.ticketId,
      type: eventType,
      actorId: input.actorId,
      actorType: "staff",
      fromStatus,
      toStatus,
      fromAssigneeId: ticket.assigneeId,
      toAssigneeId: input.assigneeId,
    });

    return updated;
  });
}

export async function changeTicketModuleWithLifecycle(input: {
  ticketId: string;
  moduleId: string | null;
  actorId: string;
  assigneeId?: string | null;
}) {
  return db.transaction(async (tx) => {
    const ticket = await tx.query.tickets.findFirst({
      where: eq(tickets.id, input.ticketId),
    });
    if (!ticket) throw new TicketLifecycleError("Ticket not found.");
    if (ticket.status === "closed") {
      throw new TicketLifecycleError("Closed tickets cannot change module.");
    }

    // Recalculate SLA deadlines when module changes.
    let slaFields: Partial<typeof tickets.$inferInsert> = {};
    if (input.moduleId) {
      const { firstResponseDueAt, resolutionDueAt } = await getSlaDeadlines({
        moduleId: input.moduleId,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
      });
      if (firstResponseDueAt && resolutionDueAt) {
        slaFields = {
          firstResponseDueAt,
          resolutionDueAt,
          slaDeadlineAt: resolutionDueAt,
        };
      }
    }

    const toAssigneeId = input.assigneeId ?? null;
    const toStatus = toAssigneeId ? "in_progress" : "open";
    const [updated] = await tx
      .update(tickets)
      .set({
        moduleId: input.moduleId,
        assigneeId: toAssigneeId,
        status: toStatus,
        updatedAt: new Date(),
        ...slaFields,
      })
      .where(eq(tickets.id, input.ticketId))
      .returning();

    await tx.insert(ticketEvents).values({
      ticketId: input.ticketId,
      type: "module_changed",
      actorId: input.actorId,
      actorType: "staff",
      fromStatus: normalizeTicketStatus(ticket.status, ticket.assigneeId),
      toStatus,
      fromAssigneeId: ticket.assigneeId,
      toAssigneeId,
      fromModuleId: ticket.moduleId,
      toModuleId: input.moduleId,
    });

    return updated;
  });
}

export async function changeTicketPriorityWithLifecycle(input: {
  ticketId: string;
  priority: "low" | "medium" | "critical";
  actorId: string;
}) {
  return db.transaction(async (tx) => {
    const ticket = await tx.query.tickets.findFirst({
      where: eq(tickets.id, input.ticketId),
    });
    if (!ticket) throw new TicketLifecycleError("Ticket not found.");
    if (ticket.status === "closed") {
      throw new TicketLifecycleError("Closed tickets cannot change priority.");
    }

    const [updated] = await tx
      .update(tickets)
      .set({ priority: input.priority, updatedAt: new Date() })
      .where(eq(tickets.id, input.ticketId))
      .returning();

    await tx.insert(ticketEvents).values({
      ticketId: input.ticketId,
      type: "priority_changed",
      actorId: input.actorId,
      actorType: "staff",
      fromStatus: normalizeTicketStatus(ticket.status, ticket.assigneeId),
      toStatus: normalizeTicketStatus(ticket.status, ticket.assigneeId),
      fromPriority: ticket.priority,
      toPriority: input.priority,
    });

    return updated;
  });
}

export async function addStaffMessageWithLifecycle(input: {
  ticketId: string;
  staffId: string;
  content: string;
  isInternalNote: boolean;
  source?: "web" | "whatsapp" | "email" | "manual" | "api";
}) {
  return db.transaction(async (tx) => {
    const ticket = await tx.query.tickets.findFirst({
      where: eq(tickets.id, input.ticketId),
    });
    if (!ticket) throw new TicketLifecycleError("Ticket not found.");
    if (ticket.status === "closed") {
      throw new TicketLifecycleError("Closed tickets cannot receive messages.");
    }

    const [message] = await tx
      .insert(ticketMessages)
      .values({
        ticketId: input.ticketId,
        senderId: input.staffId,
        senderType: "staff",
        content: input.content,
        isInternalNote: input.isInternalNote,
        source: input.source ?? "web",
      })
      .returning();

    if (!input.isInternalNote) {
      const now = new Date();
      const updates: Partial<typeof tickets.$inferInsert> = {
        updatedAt: now,
      };

      if (ticket.status === "open" && !ticket.assigneeId) {
        updates.status = "in_progress";
        updates.assigneeId = input.staffId;
      }

      if (!ticket.firstRespondedAt) {
        updates.firstRespondedAt = now;
        updates.firstRespondedById = input.staffId;
        updates.firstResponseSlaStatus = "safe";
      }

      await tx.update(tickets).set(updates).where(eq(tickets.id, input.ticketId));
    }

    return message;
  });
}

export async function resolveTicketWithLifecycle(input: {
  ticketId: string;
  actorId: string;
  resolutionNote: string;
  rootCause?: "bug" | "user_error" | "network" | "third_party" | "configuration" | "hardware" | "other" | null;
  resolvedKbIds?: string[] | null;
}) {
  const note = input.resolutionNote.trim();
  if (!note) {
    throw new TicketLifecycleError("Resolution note is required.");
  }

  return db.transaction(async (tx) => {
    const ticket = await tx.query.tickets.findFirst({
      where: eq(tickets.id, input.ticketId),
    });
    if (!ticket) throw new TicketLifecycleError("Ticket not found.");
    if (
      !canTransitionTicketStatus(ticket.status, "resolved", ticket.assigneeId)
    ) {
      throw new TicketLifecycleError(
        `Cannot resolve ticket from ${ticket.status}.`,
      );
    }

    const resolvedAt = new Date();
    const autoCloseDueAt = new Date(
      resolvedAt.getTime() + 72 * 60 * 60 * 1000,
    );
    const fromStatus = normalizeTicketStatus(ticket.status, ticket.assigneeId);

    const [updated] = await tx
      .update(tickets)
      .set({
        status: "resolved",
        resolutionNote: note,
        rootCause: input.rootCause ?? null,
        resolvedByType: "user",
        resolvedById: input.actorId,
        resolvedKbIds: input.resolvedKbIds ?? null,
        resolvedAt,
        autoCloseDueAt,
        resolutionSlaStatus: "safe",
        slaStatus: "safe",
        updatedAt: resolvedAt,
      })
      .where(eq(tickets.id, input.ticketId))
      .returning();

    await tx.insert(ticketMessages).values({
      ticketId: input.ticketId,
      senderId: input.actorId,
      senderType: "staff",
      content: note,
      isInternalNote: false,
      source: "web",
    });

    await tx.insert(ticketEvents).values([
      {
        ticketId: input.ticketId,
        type: "resolved",
        actorId: input.actorId,
        actorType: "staff",
        fromStatus,
        toStatus: "resolved",
        note,
      },
      {
        ticketId: input.ticketId,
        type: "status_changed",
        actorId: input.actorId,
        actorType: "staff",
        fromStatus,
        toStatus: "resolved",
        note,
      },
    ]);

    return updated;
  });
}

export async function reopenResolvedTicket(input: {
  ticketId: string;
  actorId: string | null;
  actorType: LifecycleActorType;
  note?: string;
}) {
  return db.transaction(async (tx) => {
    const ticket = await tx.query.tickets.findFirst({
      where: eq(tickets.id, input.ticketId),
    });
    if (!ticket) throw new TicketLifecycleError("Ticket not found.");
    if (ticket.status !== "resolved") {
      throw new TicketLifecycleError("Only resolved tickets can be reopened.");
    }
    if (ticket.autoCloseDueAt && ticket.autoCloseDueAt.getTime() < Date.now()) {
      throw new TicketLifecycleError("Resolved ticket reopen window has expired.");
    }

    const toStatus = ticket.assigneeId ? "in_progress" : "open";
    const [updated] = await tx
      .update(tickets)
      .set({
        status: toStatus,
        autoCloseDueAt: null,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, input.ticketId))
      .returning();

    await tx.insert(ticketEvents).values({
      ticketId: input.ticketId,
      type: "reopened",
      actorId: input.actorId,
      actorType: input.actorType,
      fromStatus: "resolved",
      toStatus,
      note: input.note,
    });

    return updated;
  });
}

export async function closeResolvedTicket(input: {
  ticketId: string;
  actorId: string | null;
  actorType: "staff" | "system";
  closeType: "manual_close" | "auto_close";
}) {
  return db.transaction(async (tx) => {
    const ticket = await tx.query.tickets.findFirst({
      where: eq(tickets.id, input.ticketId),
    });
    if (!ticket) throw new TicketLifecycleError("Ticket not found.");
    if (ticket.status !== "resolved") {
      throw new TicketLifecycleError("Only resolved tickets can be closed.");
    }

    const closedAt = new Date();
    const [updated] = await tx
      .update(tickets)
      .set({
        status: "closed",
        closedAt,
        closedById: input.actorType === "staff" ? input.actorId : null,
        updatedAt: closedAt,
      })
      .where(eq(tickets.id, input.ticketId))
      .returning();

    await tx.insert(ticketEvents).values({
      ticketId: input.ticketId,
      type: input.closeType,
      actorId: input.actorId,
      actorType: input.actorType,
      fromStatus: "resolved",
      toStatus: "closed",
    });

    return updated;
  });
}

export async function findActiveTicketForRequester(requesterId: string) {
  return db.query.tickets.findFirst({
    where: and(
      eq(tickets.requesterId, requesterId),
      inArray(tickets.status, ["open", "in_progress"]),
    ),
    orderBy: [desc(tickets.createdAt)],
    columns: { id: true, title: true, status: true },
  });
}

export async function addRequesterMessageWithLifecycle(input: {
  ticketId: string;
  requesterId?: string | null;
  content: string;
  source?: "web" | "whatsapp" | "email" | "manual" | "api";
}) {
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const ticket = await tx.query.tickets.findFirst({
      where: eq(tickets.id, input.ticketId),
      with: { requester: { columns: { displayName: true } } },
    });
    if (!ticket) throw new TicketLifecycleError("Ticket not found.");
    if (ticket.status === "closed") {
      throw new TicketLifecycleError("Closed tickets cannot receive updates.");
    }

    const [message] = await tx
      .insert(ticketMessages)
      .values({
        ticketId: input.ticketId,
        requesterId: input.requesterId ?? ticket.requesterId,
        senderId: null,
        senderType: "requester",
        content: input.content,
        isInternalNote: false,
        source: input.source ?? "api",
      })
      .returning();

    // A customer message always bumps lastInboundAt — this is what floats the
    // ticket to the top of the inbox and marks it unread for staff.
    if (ticket.status === "resolved") {
      if (ticket.autoCloseDueAt && ticket.autoCloseDueAt.getTime() < Date.now()) {
        throw new TicketLifecycleError("Resolved ticket reopen window has expired.");
      }

      const toStatus = ticket.assigneeId ? "in_progress" : "open";
      await tx
        .update(tickets)
        .set({ status: toStatus, autoCloseDueAt: null, lastInboundAt: now, updatedAt: now })
        .where(eq(tickets.id, input.ticketId));

      await tx.insert(ticketEvents).values({
        ticketId: input.ticketId,
        type: "reopened",
        actorId: null,
        actorType: "requester",
        fromStatus: "resolved",
        toStatus,
        note: "Requester follow-up",
      });
    } else {
      await tx
        .update(tickets)
        .set({ lastInboundAt: now, updatedAt: now })
        .where(eq(tickets.id, input.ticketId));
    }

    return {
      message,
      moduleId: ticket.moduleId,
      assigneeId: ticket.assigneeId,
      requesterName: ticket.requester?.displayName ?? null,
    };
  });

  // Best-effort realtime alert. Scope (assigned-to-me / unassigned-in-my-modules)
  // and mute are decided on the client; this just carries the metadata.
  await publishTicketEvent({
    type: "message:received",
    ticketId: input.ticketId,
    moduleId: result.moduleId,
    assigneeId: result.assigneeId,
    requesterName: result.requesterName,
    preview: input.content.slice(0, 120),
  });

  return result.message;
}

export async function createReopenedFromLink(input: {
  sourceTicketId: string;
  targetTicketId: string;
  createdById?: string | null;
}) {
  const [link] = await db
    .insert(ticketLinks)
    .values({
      sourceTicketId: input.sourceTicketId,
      targetTicketId: input.targetTicketId,
      type: "reopened_from",
      createdById: input.createdById ?? null,
    })
    .returning();
  await db.insert(ticketEvents).values({
    ticketId: input.sourceTicketId,
    type: "linked_ticket_created",
    actorId: input.createdById ?? null,
    actorType: input.createdById ? "staff" : "system",
    metadata: JSON.stringify({ targetTicketId: input.targetTicketId }),
  });
  return link;
}
