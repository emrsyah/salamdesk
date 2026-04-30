import { pgTable, text, uuid, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { userRoleEnum } from "./enums";
import { tickets, ticketMessages } from "./tickets";
import { notifications } from "./notifications";
import { userModules } from "./modules";

export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").unique(),
    phone: text("phone"),
    role: userRoleEnum("role").notNull(),
    vendor: text("vendor"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
    assignedTickets: many(tickets, { relationName: "assignee" }),
    createdTickets: many(tickets, { relationName: "creator" }),
    messages: many(ticketMessages),
    modules: many(userModules),
    notifications: many(notifications),
}));