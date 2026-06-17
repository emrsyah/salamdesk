import { relations, sql } from "drizzle-orm";
import {
    boolean,
    index,
    integer,
    jsonb,
    numeric,
    pgTable,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core/columns/vector_extension/vector";
import { modules } from "./modules";
import { tickets } from "./tickets";
import { users } from "./users";

export const knowledgeDocuments = pgTable("knowledge_documents", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    summary: text("summary"),
    sourceType: text("source_type").notNull().default("manual"),
    // An article can be relevant to several modules (e.g. a shared "reset
    // password" guide). Stored as a UUID array rather than a junction table to
    // match the existing array conventions (tags, tickets.resolvedKbIds) and to
    // keep the already-complex vector search query joinless.
    moduleIds: uuid("module_ids").array().notNull().default(sql`'{}'::uuid[]`),
    tags: text("tags").array(),
    originalFileName: text("original_file_name"),
    mimeType: text("mime_type"),
    fileSize: integer("file_size"),
    storageKey: text("storage_key"),
    fileUrl: text("file_url"),
    checksum: text("checksum"),
    ingestionStatus: text("ingestion_status").notNull().default("ready"),
    ingestionError: text("ingestion_error"),
    isActive: boolean("is_active").notNull().default(true),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    index("knowledge_documents_module_ids_idx").using("gin", table.moduleIds),
    index("knowledge_documents_source_type_idx").on(table.sourceType),
    index("knowledge_documents_ingestion_status_idx").on(table.ingestionStatus),
    index("knowledge_documents_is_active_idx").on(table.isActive),
]);

export const knowledgeChunks = pgTable("knowledge_chunks", {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: text("document_id").notNull().references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    tokenCount: integer("token_count"),
    pageNumber: integer("page_number"),
    heading: text("heading"),
    metadata: jsonb("metadata"),
    embedding: vector("embedding", { dimensions: 1024 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
    index("knowledge_chunks_document_id_idx").on(table.documentId),
    index("knowledge_chunks_chunk_index_idx").on(table.documentId, table.chunkIndex),
    index("knowledge_chunks_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
]);

export const aiSuggestions = pgTable("ai_suggestions", {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: text("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
    suggestedKbId: text("suggested_kb_id").references(() => knowledgeDocuments.id, { onDelete: "set null" }),
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

export const knowledgeDocumentsRelations = relations(knowledgeDocuments, ({ many }) => ({
    // Module association is a UUID array (`moduleIds`), not a FK — there is no
    // Drizzle relation for it; resolve module names from the modules list.
    chunks: many(knowledgeChunks),
    aiSuggestions: many(aiSuggestions),
}));

export const knowledgeChunksRelations = relations(knowledgeChunks, ({ one }) => ({
    document: one(knowledgeDocuments, { fields: [knowledgeChunks.documentId], references: [knowledgeDocuments.id] }),
}));

export const aiSuggestionsRelations = relations(aiSuggestions, ({ one }) => ({
    ticket: one(tickets, { fields: [aiSuggestions.ticketId], references: [tickets.id] }),
    knowledgeBase: one(knowledgeDocuments, { fields: [aiSuggestions.suggestedKbId], references: [knowledgeDocuments.id] }),
}));

export const knowledgeBase = knowledgeDocuments;
export const knowledgeBaseRelations = knowledgeDocumentsRelations;
