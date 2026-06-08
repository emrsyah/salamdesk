"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { tickets } from "@/db/schema/tickets";
import { auth } from "@/lib/auth/auth";
import { getKbArticleById, searchKnowledgeBase } from "@/services/knowledge.service";
import { evaluateKbMatch } from "@/services/triage-ai.service";

export type CopilotArticle = {
  id: string;
  title: string;
  snippet: string;
};

export type CopilotDraft = {
  isRelevant: boolean;
  confidence: number;
  suggestedReply: string | null;
  kbId: string;
  kbTitle: string;
};

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return session;
}

async function loadTicketContext(ticketId: string) {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: { id: true, title: true, description: true, moduleId: true },
  });
  if (!ticket) throw new Error(`Ticket ${ticketId} not found`);
  return ticket;
}

/**
 * On-demand knowledge base retrieval for the copilot panel.
 * When `query` is empty, falls back to the ticket's own title + description,
 * mirroring how intake triage searches. Module-scoped to reduce noise.
 */
export async function searchKnowledgeForTicketAction(
  ticketId: string,
  query: string,
): Promise<CopilotArticle[]> {
  await requireSession();
  const ticket = await loadTicketContext(ticketId);

  const effectiveQuery = query.trim()
    ? query.trim()
    : `${ticket.title} ${ticket.description ?? ""}`.trim();

  if (!effectiveQuery) return [];

  const articles = await searchKnowledgeBase(effectiveQuery, {
    moduleId: ticket.moduleId ?? undefined,
    limit: 5,
  });

  return articles.map((article) => ({
    id: article.id,
    title: article.title,
    snippet: article.content.slice(0, 180),
  }));
}

/**
 * Generate a grounded reply draft from a specific KB article.
 * Reuses the same evaluator the intake triage uses, so the agent gets the
 * same quality of suggested reply but on demand, against any article they pick.
 */
export async function draftReplyFromKbAction(
  ticketId: string,
  kbId: string,
): Promise<CopilotDraft> {
  await requireSession();
  const ticket = await loadTicketContext(ticketId);

  const article = await getKbArticleById(kbId);
  if (!article) throw new Error(`KB article ${kbId} not found`);

  const evaluation = await evaluateKbMatch(
    ticket.title,
    ticket.description,
    article.title,
    article.content,
  );

  return {
    isRelevant: evaluation.isRelevant,
    confidence: evaluation.confidence,
    suggestedReply: evaluation.suggestedReply,
    kbId: article.id,
    kbTitle: article.title,
  };
}
