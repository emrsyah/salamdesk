import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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

export const agentProcedures = pgTable(
  "agent_procedures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    // The semantic matcher the selection LLM reads to decide when to engage.
    whenToUse: text("when_to_use").notNull().default(""),
    // TipTap/ProseMirror JSON document. Custom inline `mention` nodes carry
    // attrs { kind: 'tool'|'kb'|'module'|'time', refId, label }.
    content: jsonb("content").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("agent_procedures_enabled_idx").on(t.enabled)]
);
