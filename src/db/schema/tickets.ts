import { pgTable, text, uuid, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { modules } from "./modules";
import { notifications } from "./notifications";
import { aiSuggestions } from "./knowledge-base";
import {
    ticketStatusEnum,
    ticketPriorityEnum,
    slaStatusEnum,
    ticketSourceEnum,
    resolvedByTypeEnum,
    rootCauseEnum,
    senderTypeEnum
} from "./enums";

export const tickets = pgTable("tickets", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    status: ticketStatusEnum("status").notNull().default("open"),
    priority: ticketPriorityEnum("priority").notNull(),
    slaStatus: slaStatusEnum("sla_status").notNull().default("safe"),
    slaDeadlineAt: timestamp("sla_deadline_at"),
    moduleId: uuid("module_id").notNull().references(() => modules.id),
    source: ticketSourceEnum("source").notNull(),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    resolvedByType: resolvedByTypeEnum("resolved_by_type"),
    resolvedById: uuid("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
    rootCause: rootCauseEnum("root_cause"),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
});

export const ticketMessages = pgTable("ticket_messages", {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: text("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").references(() => users.id, { onDelete: "set null" }),
    senderType: senderTypeEnum("sender_type").notNull(),
    content: text("content").notNull(),
    isInternalNote: boolean("is_internal_note").default(false).notNull(),
    source: ticketSourceEnum("source"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ticketEscalations = pgTable("ticket_escalations", {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: text("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
    escalatedFromId: uuid("escalated_from_id").references(() => users.id, { onDelete: "set null" }),
    escalatedToId: uuid("escalated_to_id").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason"),
    escalatedAt: timestamp("escalated_at").defaultNow().notNull(),
});

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
    module: one(modules, { fields: [tickets.moduleId], references: [modules.id] }),
    assignee: one(users, { fields: [tickets.assigneeId], references: [users.id], relationName: "assignee" }),
    createdBy: one(users, { fields: [tickets.createdById], references: [users.id], relationName: "creator" }),
    messages: many(ticketMessages),
    escalations: many(ticketEscalations),
    aiSuggestions: many(aiSuggestions),
    notifications: many(notifications),
}));

export const ticketMessagesRelations = relations(ticketMessages, ({ one }) => ({
    ticket: one(tickets, { fields: [ticketMessages.ticketId], references: [tickets.id] }),
    sender: one(users, { fields: [ticketMessages.senderId], references: [users.id] }),
}));

export const ticketEscalationsRelations = relations(ticketEscalations, ({ one }) => ({
    ticket: one(tickets, { fields: [ticketEscalations.ticketId], references: [tickets.id] }),
    escalatedFrom: one(users, { fields: [ticketEscalations.escalatedFromId], references: [users.id] }),
    escalatedTo: one(users, { fields: [ticketEscalations.escalatedToId], references: [users.id] }),
}));