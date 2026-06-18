import { pgTable, text, uuid, boolean, timestamp, numeric, integer, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { requesters } from "./requesters";
import { modules } from "./modules";
import { notifications } from "./notifications";
import { aiSuggestions } from "./knowledge-base";
import { triageEvents } from "./triage";
import {
    ticketStatusEnum,
    ticketPriorityEnum,
    slaStatusEnum,
    ticketEventTypeEnum,
    ticketLinkTypeEnum,
    ticketSourceEnum,
    resolvedByTypeEnum,
    rootCauseEnum,
    senderTypeEnum,
    slaTimerTypeEnum
} from "./enums";

export const tickets = pgTable("tickets", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    status: ticketStatusEnum("status").notNull().default("open"),
    priority: ticketPriorityEnum("priority").notNull(),
    slaStatus: slaStatusEnum("sla_status").notNull().default("safe"),
    slaDeadlineAt: timestamp("sla_deadline_at"),
    firstResponseSlaStatus: slaStatusEnum("first_response_sla_status").notNull().default("safe"),
    firstResponseDueAt: timestamp("first_response_due_at"),
    firstRespondedAt: timestamp("first_responded_at"),
    firstRespondedById: text("first_responded_by_id").references(() => users.id, { onDelete: "set null" }),
    resolutionSlaStatus: slaStatusEnum("resolution_sla_status").notNull().default("safe"),
    resolutionDueAt: timestamp("resolution_due_at"),
    moduleId: uuid("module_id").references(() => modules.id, { onDelete: "set null" }),
    requesterId: uuid("requester_id").references(() => requesters.id, { onDelete: "set null" }),
    waPhone: text("wa_phone"),
    source: ticketSourceEnum("source").notNull(),
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    openedByStaffId: text("opened_by_staff_id").references(() => users.id, { onDelete: "set null" }),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    resolvedByType: resolvedByTypeEnum("resolved_by_type"),
    resolvedById: text("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
    closedAt: timestamp("closed_at"),
    closedById: text("closed_by_id").references(() => users.id, { onDelete: "set null" }),
    autoCloseDueAt: timestamp("auto_close_due_at"),
    resolvedKbIds: text("resolved_kb_ids").array(),
    rootCause: rootCauseEnum("root_cause"),
    resolutionNote: text("resolution_note"),
    // AI triage fields
    moduleConfidence: numeric("module_confidence", { precision: 4, scale: 2 }),
    moduleSetBy: text("module_set_by"), // "user" | "ai" | "system"
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
});

export const ticketMessages = pgTable("ticket_messages", {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: text("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
    senderId: text("sender_id").references(() => users.id, { onDelete: "set null" }),
    requesterId: uuid("requester_id").references(() => requesters.id, { onDelete: "set null" }),
    senderType: senderTypeEnum("sender_type").notNull(),
    content: text("content").notNull(),
    isInternalNote: boolean("is_internal_note").default(false).notNull(),
    source: ticketSourceEnum("source"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
    // Every per-ticket message query (triage counts, conversation fetch,
    // getTicketById, auto-reply worker) filters by ticket_id and orders by
    // created_at. Without this, Postgres seq-scans the table and the count
    // query hits the statement timeout.
    ticketCreatedIdx: index("ticket_messages_ticket_id_created_at_idx").on(t.ticketId, t.createdAt),
}));

export const ticketMessageAttachments = pgTable("ticket_message_attachments", {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id").notNull().references(() => ticketMessages.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ticketEscalations = pgTable("ticket_escalations", {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: text("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
    escalatedFromId: text("escalated_from_id").references(() => users.id, { onDelete: "set null" }),
    escalatedToId: text("escalated_to_id").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason"),
    escalatedAt: timestamp("escalated_at").defaultNow().notNull(),
});

export const ticketEvents = pgTable("ticket_events", {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: text("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
    type: ticketEventTypeEnum("type").notNull(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorType: senderTypeEnum("actor_type").notNull().default("system"),
    fromStatus: ticketStatusEnum("from_status"),
    toStatus: ticketStatusEnum("to_status"),
    fromAssigneeId: text("from_assignee_id").references(() => users.id, { onDelete: "set null" }),
    toAssigneeId: text("to_assignee_id").references(() => users.id, { onDelete: "set null" }),
    fromModuleId: uuid("from_module_id").references(() => modules.id, { onDelete: "set null" }),
    toModuleId: uuid("to_module_id").references(() => modules.id, { onDelete: "set null" }),
    fromPriority: ticketPriorityEnum("from_priority"),
    toPriority: ticketPriorityEnum("to_priority"),
    slaTimer: slaTimerTypeEnum("sla_timer"),
    note: text("note"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ticketLinks = pgTable("ticket_links", {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceTicketId: text("source_ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
    targetTicketId: text("target_ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
    type: ticketLinkTypeEnum("type").notNull(),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
    module: one(modules, { fields: [tickets.moduleId], references: [modules.id] }),
    requester: one(requesters, { fields: [tickets.requesterId], references: [requesters.id] }),
    assignee: one(users, { fields: [tickets.assigneeId], references: [users.id], relationName: "assignee" }),
    openedByStaff: one(users, { fields: [tickets.openedByStaffId], references: [users.id], relationName: "openedByStaff" }),
    createdBy: one(users, { fields: [tickets.createdById], references: [users.id], relationName: "creator" }),
    messages: many(ticketMessages),
    escalations: many(ticketEscalations),
    events: many(ticketEvents),
    sourceLinks: many(ticketLinks, { relationName: "sourceTicketLinks" }),
    targetLinks: many(ticketLinks, { relationName: "targetTicketLinks" }),
    aiSuggestions: many(aiSuggestions),
    triageEvents: many(triageEvents),
    notifications: many(notifications),
}));

export const ticketMessagesRelations = relations(ticketMessages, ({ one, many }) => ({
    ticket: one(tickets, { fields: [ticketMessages.ticketId], references: [tickets.id] }),
    sender: one(users, { fields: [ticketMessages.senderId], references: [users.id] }),
    requester: one(requesters, { fields: [ticketMessages.requesterId], references: [requesters.id] }),
    attachments: many(ticketMessageAttachments),
}));

export const ticketMessageAttachmentsRelations = relations(ticketMessageAttachments, ({ one }) => ({
    message: one(ticketMessages, { fields: [ticketMessageAttachments.messageId], references: [ticketMessages.id] }),
}));

export const ticketEscalationsRelations = relations(ticketEscalations, ({ one }) => ({
    ticket: one(tickets, { fields: [ticketEscalations.ticketId], references: [tickets.id] }),
    escalatedFrom: one(users, { fields: [ticketEscalations.escalatedFromId], references: [users.id], relationName: "escalatedFrom" }),
    escalatedTo: one(users, { fields: [ticketEscalations.escalatedToId], references: [users.id], relationName: "escalatedTo" }),
}));

export const ticketEventsRelations = relations(ticketEvents, ({ one }) => ({
    ticket: one(tickets, { fields: [ticketEvents.ticketId], references: [tickets.id] }),
    actor: one(users, { fields: [ticketEvents.actorId], references: [users.id] }),
    fromAssignee: one(users, { fields: [ticketEvents.fromAssigneeId], references: [users.id], relationName: "fromAssignee" }),
    toAssignee: one(users, { fields: [ticketEvents.toAssigneeId], references: [users.id], relationName: "toAssignee" }),
    fromModule: one(modules, { fields: [ticketEvents.fromModuleId], references: [modules.id], relationName: "fromModule" }),
    toModule: one(modules, { fields: [ticketEvents.toModuleId], references: [modules.id], relationName: "toModule" }),
}));

export const ticketLinksRelations = relations(ticketLinks, ({ one }) => ({
    sourceTicket: one(tickets, { fields: [ticketLinks.sourceTicketId], references: [tickets.id], relationName: "sourceTicketLinks" }),
    targetTicket: one(tickets, { fields: [ticketLinks.targetTicketId], references: [tickets.id], relationName: "targetTicketLinks" }),
    createdBy: one(users, { fields: [ticketLinks.createdById], references: [users.id] }),
}));
