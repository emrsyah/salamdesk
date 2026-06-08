import { db } from "@/db";
import { knowledgeBase, knowledgeChunks } from "@/db/schema/knowledge-base";
import { and, asc, count, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { chunkKnowledgeContent, type KnowledgeChunk } from "./knowledge-chunking.service";
import { embedKnowledgeQuery, formatPgVector } from "./knowledge-embedding.service";

export type KbArticle = typeof knowledgeBase.$inferSelect;

async function replaceKnowledgeChunks(
  documentId: string,
  chunks: KnowledgeChunk[] | string,
  embeddings?: number[][],
  tx: Pick<typeof db, "delete" | "insert"> = db
) {
  const preparedChunks = typeof chunks === "string" ? chunkKnowledgeContent(chunks) : chunks;

  await tx
    .delete(knowledgeChunks)
    .where(eq(knowledgeChunks.documentId, documentId))
    .execute();

  if (preparedChunks.length === 0) {
    return;
  }

  await tx
    .insert(knowledgeChunks)
    .values(
      preparedChunks.map((chunk, index) => ({
        documentId,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        tokenCount: chunk.tokenCount,
        pageNumber: chunk.pageNumber,
        heading: chunk.heading,
        metadata: chunk.metadata,
        embedding: embeddings?.[index],
      }))
    )
    .execute();
}

/**
 * Search knowledge base articles by keyword.
 * Uses simple ILIKE matching across title, content, and tags.
 * No vector embeddings yet — pure SQL full-text-like search.
 *
 * Returns up to `limit` results, optionally scoped to a module.
 */
export async function searchKnowledgeBase(
  query: string,
  options?: { moduleId?: string; limit?: number }
): Promise<KbArticle[]> {
  const limit = options?.limit ?? 5;
  const pattern = `%${query}%`;

  if (process.env.VOYAGE_API_KEY) {
    try {
      const queryEmbedding = await embedKnowledgeQuery(query);
      const distance = sql<number>`${knowledgeChunks.embedding} <=> ${formatPgVector(queryEmbedding)}::vector`;
      const vectorConditions = [
        isNotNull(knowledgeChunks.embedding),
        eq(knowledgeBase.ingestionStatus, "ready"),
        eq(knowledgeBase.isActive, true),
      ];

      if (options?.moduleId) {
        vectorConditions.push(eq(knowledgeBase.moduleId, options.moduleId));
      }

      const vectorRows = await db
        .select({
          document: knowledgeBase,
          distance,
        })
        .from(knowledgeChunks)
        .innerJoin(knowledgeBase, eq(knowledgeBase.id, knowledgeChunks.documentId))
        .where(and(...vectorConditions))
        .orderBy(asc(distance))
        .limit(limit * 3)
        .execute();

      const seen = new Set<string>();
      const documents: KbArticle[] = [];

      for (const row of vectorRows) {
        if (seen.has(row.document.id)) {
          continue;
        }

        seen.add(row.document.id);
        documents.push(row.document);

        if (documents.length >= limit) {
          return documents;
        }
      }
    } catch (error) {
      console.warn("[KB] Vector search failed, falling back to keyword search:", error);
    }
  }

  const conditions = [
    eq(knowledgeBase.ingestionStatus, "ready"),
    eq(knowledgeBase.isActive, true),
    or(
      ilike(knowledgeBase.title, pattern),
      ilike(knowledgeBase.content, pattern),
      ilike(knowledgeChunks.content, pattern)
    ),
  ];

  if (options?.moduleId) {
    conditions.push(eq(knowledgeBase.moduleId, options.moduleId));
  }

  const rows = await db
    .select({
      document: knowledgeBase,
    })
    .from(knowledgeBase)
    .leftJoin(knowledgeChunks, eq(knowledgeChunks.documentId, knowledgeBase.id))
    .where(and(...conditions))
    .limit(limit)
    .execute();

  const seen = new Set<string>();
  const documents: KbArticle[] = [];

  for (const row of rows) {
    if (seen.has(row.document.id)) {
      continue;
    }

    seen.add(row.document.id);
    documents.push(row.document);
  }

  return documents;
}

/**
 * Fetch a single KB article by ID.
 */
export async function getKbArticleById(
  id: string
): Promise<KbArticle | null> {
  const result = await db
    .select()
    .from(knowledgeBase)
    .where(eq(knowledgeBase.id, id))
    .limit(1)
    .execute();

  return result[0] ?? null;
}

export async function getKbArticleChunkCount(id: string): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(knowledgeChunks)
    .where(eq(knowledgeChunks.documentId, id))
    .execute();

  return result[0]?.value ?? 0;
}

/**
 * Get all KB articles, optionally filtered by module.
 */
export async function getAllKbArticles(options?: {
  moduleId?: string;
}): Promise<KbArticle[]> {
  const conditions = options?.moduleId
    ? [eq(knowledgeBase.moduleId, options.moduleId)]
    : [];

  return db
    .select()
    .from(knowledgeBase)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(knowledgeBase.createdAt)
    .execute();
}

/**
 * Create a new KB article.
 */
export async function createKbArticle(data: {
  id: string;
  title: string;
  content: string;
  moduleId?: string | null;
  tags?: string[];
  createdById?: string | null;
}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(knowledgeBase)
      .values({
        id: data.id,
        title: data.title,
        content: data.content,
        sourceType: "manual",
        ingestionStatus: "ready",
        moduleId: data.moduleId ?? null,
        tags: data.tags ?? [],
        createdById: data.createdById ?? null,
      })
      .execute();

    await replaceKnowledgeChunks(data.id, data.content, undefined, tx);
  });
}

export async function createUploadedKnowledgeDocument(data: {
  id: string;
  title: string;
  moduleId?: string | null;
  tags?: string[];
  createdById?: string | null;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  fileUrl: string;
  checksum?: string | null;
}) {
  await db
    .insert(knowledgeBase)
    .values({
      id: data.id,
      title: data.title,
      content: "",
      sourceType: "upload",
      ingestionStatus: "pending",
      moduleId: data.moduleId ?? null,
      tags: data.tags ?? [],
      createdById: data.createdById ?? null,
      originalFileName: data.originalFileName,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      storageKey: data.storageKey,
      fileUrl: data.fileUrl,
      checksum: data.checksum ?? null,
    })
    .execute();
}

export async function markKnowledgeDocumentProcessing(id: string) {
  await db
    .update(knowledgeBase)
    .set({
      ingestionStatus: "processing",
      ingestionError: null,
      updatedAt: new Date(),
    })
    .where(eq(knowledgeBase.id, id))
    .execute();
}

export async function completeKnowledgeDocumentIngestion(data: {
  id: string;
  content: string;
  chunks: KnowledgeChunk[];
  embeddings: number[][];
}) {
  await db.transaction(async (tx) => {
    await tx
      .update(knowledgeBase)
      .set({
        content: data.content,
        ingestionStatus: "ready",
        ingestionError: null,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeBase.id, data.id))
      .execute();

    await replaceKnowledgeChunks(data.id, data.chunks, data.embeddings, tx);
  });
}

export async function failKnowledgeDocumentIngestion(id: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown ingestion error";

  await db
    .update(knowledgeBase)
    .set({
      ingestionStatus: "failed",
      ingestionError: message.slice(0, 2000),
      updatedAt: new Date(),
    })
    .where(eq(knowledgeBase.id, id))
    .execute();
}

/**
 * Update an existing KB article.
 */
export async function updateKbArticle(
  id: string,
  data: Partial<{
    title: string;
    content: string;
    moduleId: string | null;
    tags: string[];
    isActive: boolean;
  }>
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(knowledgeBase)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeBase.id, id))
      .execute();

    if (data.content !== undefined) {
      await replaceKnowledgeChunks(id, data.content, undefined, tx);
    }
  });
}

export async function setKbArticleActive(
  id: string,
  isActive: boolean
): Promise<void> {
  await db
    .update(knowledgeBase)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(eq(knowledgeBase.id, id))
    .execute();
}

/**
 * Delete a KB article.
 */
export async function deleteKbArticle(id: string): Promise<void> {
  await db
    .delete(knowledgeBase)
    .where(eq(knowledgeBase.id, id))
    .execute();
}

import { tickets } from "@/db/schema/tickets";

/**
 * Get KB Gap Detection report.
 * Finds resolved tickets that do not have any linked KB articles.
 */
export async function getKbGaps(limit = 20) {
  return db
    .select({
      ticketId: tickets.id,
      title: tickets.title,
      description: tickets.description,
      moduleId: tickets.moduleId,
      createdAt: tickets.createdAt,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.status, "resolved"),
        or(
          isNull(tickets.resolvedKbIds),
          sql`cardinality(${tickets.resolvedKbIds}) = 0`
        )
      )
    )
    .orderBy(desc(tickets.resolvedAt))
    .limit(limit)
    .execute();
}
