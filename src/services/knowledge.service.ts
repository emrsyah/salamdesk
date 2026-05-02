import { db } from "@/db";
import { knowledgeBase } from "@/db/schema/knowledge-base";
import { eq, or, ilike, and } from "drizzle-orm";

export type KbArticle = typeof knowledgeBase.$inferSelect;

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

  const conditions = [
    or(
      ilike(knowledgeBase.title, pattern),
      ilike(knowledgeBase.content, pattern)
    ),
  ];

  if (options?.moduleId) {
    conditions.push(eq(knowledgeBase.moduleId, options.moduleId));
  }

  return db
    .select()
    .from(knowledgeBase)
    .where(and(...conditions))
    .limit(limit)
    .execute();
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
  await db
    .insert(knowledgeBase)
    .values({
      id: data.id,
      title: data.title,
      content: data.content,
      moduleId: data.moduleId ?? null,
      tags: data.tags ?? [],
      createdById: data.createdById ?? null,
    })
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
  }>
): Promise<void> {
  await db
    .update(knowledgeBase)
    .set({
      ...data,
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
import { isNull, sql, desc } from "drizzle-orm";

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
