import { pgTable, text, uuid, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

export const apiKeys = pgTable("api_keys", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    hashedKey: text("hashed_key").notNull(),
    prefix: text("prefix").notNull(),
    createdById: text("created_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").default(true).notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
    createdBy: one(users, { fields: [apiKeys.createdById], references: [users.id] }),
}));
