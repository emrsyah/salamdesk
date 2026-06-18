import { db } from "@/db";
import { knowledgeBase, knowledgeChunks } from "@/db/schema/knowledge-base";
import { and, asc, count, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { chunkKnowledgeContent, type KnowledgeChunk } from "./knowledge-chunking.service";
import { embedKnowledgeQuery, formatPgVector } from "./knowledge-embedding.service";

export type KbArticle = typeof knowledgeBase.$inferSelect;

// Hybrid ranking weights for vector search: how much the chunk semantic
// similarity vs. a lexical title match contribute to the final rank.
const SEMANTIC_WEIGHT = 0.75;
const TITLE_WEIGHT = 0.25;

const STOP_WORDS = new Set([
  "yang", "di", "ke", "dari", "dan", "atau", "untuk", "pada", "ada", "tidak",
  "the", "a", "an", "to", "of", "is", "in", "on", "for", "and", "or",
]);

/** Lowercase word tokens (>=2 chars, excluding common stop words). */
function tokenize(text: string): string[] {
  const tokens = (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (t) => t.length >= 2 && !STOP_WORDS.has(t),
  );
  return Array.from(new Set(tokens));
}

/** Fraction of query tokens that appear in the title (0..1). */
function titleMatchScore(queryTokens: string[], title: string): number {
  if (queryTokens.length === 0) return 0;
  const titleTokens = new Set(tokenize(title));
  if (titleTokens.size === 0) return 0;
  const hits = queryTokens.filter((t) => titleTokens.has(t)).length;
  return hits / queryTokens.length;
}

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
 * Search knowledge base articles, optionally scoped to a module.
 *
 * Vector search (Voyage embeddings) when available, falling back to ILIKE
 * keyword matching across title, content, and chunk text.
 *
 * Module scoping:
 *  - `scope: "module"` (the default when a `moduleId` is given) restricts
 *    results to articles tagged with that module.
 *  - `scope: "all"` ignores the module and ranks purely by relevance — used as
 *    the "expand search" fallback when an agent finds nothing in their module.
 */
export async function searchKnowledgeBase(
  query: string,
  options?: { moduleId?: string; scope?: "module" | "all"; limit?: number }
): Promise<KbArticle[]> {
  const limit = options?.limit ?? 5;
  const pattern = `%${query}%`;
  const scope = options?.scope ?? (options?.moduleId ? "module" : "all");
  // Module-scoped search also includes articles with NO module assigned —
  // an unassigned KB is treated as global ("belongs to all modules").
  const moduleFilter =
    scope === "module" && options?.moduleId
      ? sql`(${knowledgeBase.moduleIds} && ARRAY[${options.moduleId}]::uuid[] or cardinality(${knowledgeBase.moduleIds}) = 0)`
      : null;

  if (process.env.VOYAGE_API_KEY) {
    try {
      const queryEmbedding = await embedKnowledgeQuery(query);
      const distance = sql<number>`${knowledgeChunks.embedding} <=> ${formatPgVector(queryEmbedding)}::vector`;
      const vectorConditions = [
        isNotNull(knowledgeChunks.embedding),
        eq(knowledgeBase.ingestionStatus, "ready"),
        eq(knowledgeBase.isActive, true),
      ];

      if (moduleFilter) {
        vectorConditions.push(moduleFilter);
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

      // Keep the best (smallest) chunk distance per document — rows are ordered
      // ascending, so the first occurrence of each document is its best chunk.
      const byDoc = new Map<string, { document: KbArticle; distance: number }>();
      for (const row of vectorRows) {
        if (!byDoc.has(row.document.id)) {
          byDoc.set(row.document.id, { document: row.document, distance: Number(row.distance) });
        }
      }

      if (byDoc.size > 0) {
        // Hybrid score: semantic similarity (chunk cosine) blended with a lexical
        // title match, so an article whose TITLE clearly matches the query isn't
        // buried under a chunk that happens to be semantically close.
        const queryTokens = tokenize(query);
        const scored = Array.from(byDoc.values()).map(({ document, distance }) => {
          const semantic = 1 - distance; // pgvector "<=>" is cosine distance (0..2)
          const title = titleMatchScore(queryTokens, document.title);
          return { document, score: SEMANTIC_WEIGHT * semantic + TITLE_WEIGHT * title };
        });
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, limit).map((s) => s.document);
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

  if (moduleFilter) {
    conditions.push(moduleFilter);
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
  // Include unassigned (no-module) articles — they're treated as global.
  const moduleFilter = options?.moduleId
    ? sql`(${knowledgeBase.moduleIds} && ARRAY[${options.moduleId}]::uuid[] or cardinality(${knowledgeBase.moduleIds}) = 0)`
    : undefined;

  return db
    .select()
    .from(knowledgeBase)
    .where(moduleFilter)
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
  moduleIds?: string[];
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
        moduleIds: data.moduleIds ?? [],
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
  moduleIds?: string[];
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
      moduleIds: data.moduleIds ?? [],
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

/**
 * Re-enqueue ingestion for an uploaded document (e.g. after a failure).
 * Resets the status to "pending" so the UI reflects the retry immediately.
 */
export async function requeueKnowledgeDocumentIngestion(id: string) {
  const [doc] = await db
    .select({
      id: knowledgeBase.id,
      fileUrl: knowledgeBase.fileUrl,
      originalFileName: knowledgeBase.originalFileName,
      mimeType: knowledgeBase.mimeType,
    })
    .from(knowledgeBase)
    .where(eq(knowledgeBase.id, id));

  if (!doc) throw new Error("Dokumen tidak ditemukan.");
  if (!doc.fileUrl) {
    throw new Error("Dokumen ini bukan hasil upload — tidak ada file untuk diproses ulang.");
  }

  await db
    .update(knowledgeBase)
    .set({ ingestionStatus: "pending", ingestionError: null, updatedAt: new Date() })
    .where(eq(knowledgeBase.id, id))
    .execute();

  const { KNOWLEDGE_INGESTION_JOBS, knowledgeIngestionQueue } = await import("@/lib/queue");
  await knowledgeIngestionQueue.add(KNOWLEDGE_INGESTION_JOBS.ingestDocument, {
    documentId: doc.id,
    fileUrl: doc.fileUrl,
    fileName: doc.originalFileName ?? "document",
    mimeType: doc.mimeType ?? "application/octet-stream",
  });
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
    moduleIds: string[];
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
