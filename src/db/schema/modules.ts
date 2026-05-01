import { pgTable, text, uuid, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { tickets } from "./tickets";
import { knowledgeBase, quickReplies } from "./knowledge-base";
import { ticketPriorityEnum } from "./enums";

export const modules = pgTable("modules", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").unique().notNull(),
    color: text("color"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userModules = pgTable("user_modules", {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
});

export const slaConfigs = pgTable("sla_configs", {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
    priority: ticketPriorityEnum("priority").notNull(),
    responseTimeMinutes: integer("response_time_minutes").notNull(),
    resolutionTimeMinutes: integer("resolution_time_minutes").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
});

export const modulesRelations = relations(modules, ({ many }) => ({
    tickets: many(tickets),
    slaConfigs: many(slaConfigs),
    knowledgeBase: many(knowledgeBase),
    quickReplies: many(quickReplies),
    userModules: many(userModules),
}));

export const userModulesRelations = relations(userModules, ({ one }) => ({
    user: one(users, { fields: [userModules.userId], references: [users.id] }),
    module: one(modules, { fields: [userModules.moduleId], references: [modules.id] }),
}));