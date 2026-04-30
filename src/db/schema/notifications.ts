import { pgTable, text, uuid, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { tickets } from "./tickets";
import { notificationTypeEnum } from "./enums";

export const notifications = pgTable("notifications", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    ticketId: text("ticket_id").references(() => tickets.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    message: text("message"),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
    user: one(users, { fields: [notifications.userId], references: [users.id] }),
    ticket: one(tickets, { fields: [notifications.ticketId], references: [tickets.id] }),
}));