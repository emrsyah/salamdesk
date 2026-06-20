"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { after } from "next/server";
import { startActiveObservation, propagateAttributes } from "@langfuse/tracing";
import { flushTraces } from "@/lib/langfuse";
import { db } from "@/db";
import { tickets } from "@/db/schema/tickets";
import { auth } from "@/lib/auth/auth";
import { getKbArticleById, searchKnowledgeBase } from "@/services/knowledge.service";
import { buildTicketConversation } from "@/services/conversation-context.service";
import { getAiConfig } from "@/services/ai-config.service";
import { evaluateKbMatch, refineReplyText, type RefineMode } from "@/services/triage-ai.service";
import { exaSearch } from "@/services/exa.service";

export type CopilotArticle = {
  id: string;
  title: string;
  snippet: string;
  moduleIds: string[];
  /** True when the article shares no module with the current ticket. */
  isFromOtherModule: boolean;
};

export type CopilotSearchScope = "module" | "all";

export type CopilotWebResult = {
  title: string;
  url: string;
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
 * mirroring how intake triage searches.
 *
 * `scope` controls module filtering:
 *  - "module" (default): only articles tagged with the ticket's module.
 *  - "all": ignore the module and rank purely by relevance — the "expand
 *    search" the panel offers when nothing matched within the module.
 */
export async function searchKnowledgeForTicketAction(
  ticketId: string,
  query: string,
  scope: CopilotSearchScope = "module",
): Promise<CopilotArticle[]> {
  await requireSession();
  const ticket = await loadTicketContext(ticketId);

  const effectiveQuery = query.trim()
    ? query.trim()
    : `${ticket.title} ${ticket.description ?? ""}`.trim();

  if (!effectiveQuery) return [];

  const articles = await searchKnowledgeBase(effectiveQuery, {
    moduleId: ticket.moduleId ?? undefined,
    scope,
    limit: 5,
  });

  return articles.map((article) => ({
    id: article.id,
    title: article.title,
    snippet: article.content.slice(0, 180),
    moduleIds: article.moduleIds,
    // Unassigned (no-module) articles are global, so they're never "from
    // another module".
    isFromOtherModule:
      ticket.moduleId && article.moduleIds.length > 0
        ? !article.moduleIds.includes(ticket.moduleId)
        : false,
  }));
}

/**
 * Web search (Exa) for the copilot panel. Falls back to the ticket title when
 * the query is empty. Requires EXA_API_KEY; surfaces a clear error otherwise so
 * the UI can degrade gracefully.
 */
export async function webSearchForTicketAction(
  ticketId: string,
  query: string,
): Promise<CopilotWebResult[]> {
  await requireSession();
  const effectiveQuery = query.trim()
    ? query.trim()
    : (await loadTicketContext(ticketId)).title;
  if (!effectiveQuery) return [];

  const results = await exaSearch(effectiveQuery, 5);
  return results.map((r) => ({
    title: r.title || r.url,
    url: r.url,
    snippet: r.text.slice(0, 180),
  }));
}

/**
 * Rewrite reply text per one refine mode (shorten, friendlier, etc.).
 * Powers the copilot draft quick actions and the reply box "Rapikan" menu.
 */
export async function refineReplyTextAction(
  ticketId: string,
  text: string,
  mode: RefineMode | "custom",
  customInstruction?: string,
): Promise<string> {
  const session = await requireSession();
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Teks kosong.");
  if (mode === "custom" && !customInstruction?.trim()) {
    throw new Error("Instruksi kosong.");
  }

  const ticket = await loadTicketContext(ticketId);
  after(() => flushTraces());
  return propagateAttributes(
    {
      sessionId: ticketId,
      userId: session.user.id,
      tags: ["copilot", "refine-reply"],
      metadata: { mode },
    },
    () =>
      startActiveObservation("copilot-refine-reply", async (span) => {
        span.update({ input: { ticketId, mode } });
        const refined = await refineReplyText({
          text: trimmed.slice(0, 8000),
          mode: mode === "custom" ? undefined : mode,
          customInstruction: mode === "custom" ? customInstruction : null,
          ticketTitle: ticket.title,
        });
        span.update({ output: refined });
        return refined;
      }),
  );
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
  const session = await requireSession();
  const [ticket, article, config] = await Promise.all([
    loadTicketContext(ticketId),
    getKbArticleById(kbId),
    getAiConfig(),
  ]);
  if (!article) throw new Error(`KB article ${kbId} not found`);

  after(() => flushTraces());
  return propagateAttributes(
    {
      sessionId: ticketId,
      userId: session.user.id,
      tags: ["copilot", "draft-from-kb"],
      metadata: { kbId },
    },
    () =>
      startActiveObservation("copilot-draft-from-kb", async (span) => {
        span.update({ input: { ticketId, kbId, kbTitle: article.title } });
        const conversation = await buildTicketConversation(ticketId, {
          fallbackText: ticket.description ?? ticket.title,
        });
        const evaluation = await evaluateKbMatch({
          conversation: conversation.messages,
          ticketTitle: ticket.title,
          kbTitle: article.title,
          kbContent: article.content,
          behavior: {
            agentName: config.agentName,
            persona: config.persona,
            tone: config.tone,
            language: config.language,
            replySignature: config.replySignature,
            guardrails: config.guardrails,
          },
        });

        const draft: CopilotDraft = {
          isRelevant: evaluation.isRelevant,
          confidence: evaluation.confidence,
          suggestedReply: evaluation.suggestedReply,
          kbId: article.id,
          kbTitle: article.title,
        };
        span.update({ output: draft });
        return draft;
      }),
  );
}
