import { relations } from "drizzle-orm";
import { boolean, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { knowledgeBase } from "./knowledge-base";
import { tickets } from "./tickets";

export const triageEvents = pgTable("triage_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: text("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  trigger: text("trigger").notNull().default("intake"),
  status: text("status").notNull(),
  moduleId: uuid("module_id"),
  moduleName: text("module_name"),
  moduleConfidence: numeric("module_confidence", { precision: 4, scale: 2 }),
  moduleReason: text("module_reason"),
  priority: text("priority"),
  priorityReason: text("priority_reason"),
  suggestedKbId: text("suggested_kb_id").references(() => knowledgeBase.id, { onDelete: "set null" }),
  suggestedKbTitle: text("suggested_kb_title"),
  replyConfidence: numeric("reply_confidence", { precision: 4, scale: 2 }),
  suggestedReply: text("suggested_reply"),
  autoReplyAllowed: boolean("auto_reply_allowed"),
  autoReplySent: boolean("auto_reply_sent").default(false).notNull(),
  autoReplyBlockedReason: text("auto_reply_blocked_reason"),
  model: text("model"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const triageEventsRelations = relations(triageEvents, ({ one }) => ({
  ticket: one(tickets, { fields: [triageEvents.ticketId], references: [tickets.id] }),
  suggestedKb: one(knowledgeBase, {
    fields: [triageEvents.suggestedKbId],
    references: [knowledgeBase.id],
  }),
}));
