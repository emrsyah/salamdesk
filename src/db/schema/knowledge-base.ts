import { pgTable, text, uuid, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { modules } from "./modules";
import { users } from "./users";
import { tickets } from "./tickets";

export const knowledgeBase = pgTable("knowledge_base", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    moduleId: uuid("module_id").references(() => modules.id, { onDelete: "set null" }),
    tags: text("tags").array(),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiSuggestions = pgTable("ai_suggestions", {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: text("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
    suggestedKbId: text("suggested_kb_id").references(() => knowledgeBase.id, { onDelete: "set null" }),
    confidenceScore: numeric("confidence_score", { precision: 4, scale: 2 }),
    wasHelpful: boolean("was_helpful"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quickReplies = pgTable("quick_replies", {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(),
    content: text("content").notNull(),
    moduleId: uuid("module_id").references(() => modules.id, { onDelete: "set null" }),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const knowledgeBaseRelations = relations(knowledgeBase, ({ one, many }) => ({
    module: one(modules, { fields: [knowledgeBase.moduleId], references: [modules.id] }),
    aiSuggestions: many(aiSuggestions),
}));

export const aiSuggestionsRelations = relations(aiSuggestions, ({ one }) => ({
    ticket: one(tickets, { fields: [aiSuggestions.ticketId], references: [tickets.id] }),
    knowledgeBase: one(knowledgeBase, { fields: [aiSuggestions.suggestedKbId], references: [knowledgeBase.id] }),
}));