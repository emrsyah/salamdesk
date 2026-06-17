import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const agentCredentials = pgTable("agent_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // bearer | api_key_header | basic | custom
  secretEncrypted: text("secret_encrypted").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentTools = pgTable(
  "agent_tools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull(), // what the LLM reads to decide to call it
    type: text("type").notNull(), // http | exa_search
    config: jsonb("config").notNull(),
    credentialId: uuid("credential_id").references(() => agentCredentials.id, {
      onDelete: "set null",
    }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("agent_tools_enabled_idx").on(t.enabled)]
);

export const agentToolsRelations = relations(agentTools, ({ one }) => ({
  credential: one(agentCredentials, {
    fields: [agentTools.credentialId],
    references: [agentCredentials.id],
  }),
}));
