import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiSuggestions } from "@/db/schema/knowledge-base";
import { ticketMessages, tickets } from "@/db/schema/tickets";
import { triageEvents } from "@/db/schema/triage";
import { AI_MODEL } from "@/lib/ai";
import { aiAutoReplyQueue } from "@/lib/queue";
import { canAutoReply } from "@/services/auto-reply-policy.service";
import { getAiConfig } from "@/services/ai-config.service";
import { evaluateKbMatch, classifyModule, classifyPriority } from "@/services/triage-ai.service";
import { searchKnowledgeBase } from "@/services/knowledge.service";
import { getAllModules } from "@/services/module.service";
import type { TicketPriority } from "@/services/ticket.service";
import { sendWhatsAppMessage } from "@/services/whatsapp.service";

/** Count AI auto-replies already sent on a ticket (public, non-internal). */
async function countAutoReplies(ticketId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(ticketMessages)
    .where(
      and(
        eq(ticketMessages.ticketId, ticketId),
        eq(ticketMessages.senderType, "ai_agent"),
        eq(ticketMessages.isInternalNote, false),
      ),
    );
  return row?.value ?? 0;
}

export type TriageTrigger = "intake" | "manual" | "message_added" | "retry";

export type TriageResult = {
  ticketId: string;
  moduleId: string | null;
  moduleName: string | null;
  moduleConfidence: number;
  priority: TicketPriority;
  kbArticleId: string | null;
  kbArticleTitle: string | null;
  replyConfidence: number;
  autoReplied: boolean;
  suggestedReply: string | null;
};

function confidenceToDb(value: number) {
  return Math.max(0, Math.min(1, value)).toFixed(2);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown triage error";
}

export async function triageTicket(
  ticketId: string,
  trigger: TriageTrigger = "intake",
): Promise<TriageResult> {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: {
      id: true,
      title: true,
      description: true,
      priority: true,
      source: true,
      waPhone: true,
      moduleId: true,
    },
  });

  if (!ticket) {
    throw new Error(`Ticket ${ticketId} not found`);
  }

  const result: TriageResult = {
    ticketId,
    moduleId: ticket.moduleId ?? null,
    moduleName: null,
    moduleConfidence: 0,
    priority: ticket.priority,
    kbArticleId: null,
    kbArticleTitle: null,
    replyConfidence: 0,
    autoReplied: false,
    suggestedReply: null,
  };

  const config = await getAiConfig();

  // Master switch — skip the whole AI pipeline when triage is turned off.
  if (!config.aiTriageEnabled) {
    await db.insert(triageEvents).values({
      ticketId,
      trigger,
      status: "skipped",
      priority: ticket.priority,
      autoReplyBlockedReason: "AI triage is disabled in settings.",
      model: AI_MODEL,
      error: null,
    });
    return result;
  }

  let moduleReason: string | null = null;
  let priorityReason: string | null = null;
  let autoReplyAllowed: boolean | null = null;
  let autoReplyBlockedReason: string | null = null;

  try {
    const activeModules = await getAllModules({ activeOnly: true });

    let classifiedModuleId = ticket.moduleId;
    let classifiedModuleName: string | null = null;
    let moduleConfidence = 0;

    if (!ticket.moduleId && config.autoClassifyModule && activeModules.length > 0) {
      const moduleResult = await classifyModule(ticket.title, ticket.description, activeModules);
      // Only apply the AI's module if it clears the confidence bar; otherwise
      // leave it unassigned for a human to triage.
      if (moduleResult.confidence >= config.moduleConfidenceThreshold) {
        classifiedModuleId = moduleResult.moduleId;
        classifiedModuleName = moduleResult.moduleName;
        moduleConfidence = moduleResult.confidence;
        moduleReason = moduleResult.reasoning;
      } else {
        moduleConfidence = moduleResult.confidence;
        moduleReason = `Below module confidence threshold (${config.moduleConfidenceThreshold}); left unassigned.`;
      }
    } else if (ticket.moduleId) {
      const module = activeModules.find((candidate) => candidate.id === ticket.moduleId);
      classifiedModuleName = module?.name ?? null;
      moduleConfidence = 1;
      moduleReason = "Module was already set before AI triage.";
    }

    result.moduleId = classifiedModuleId;
    result.moduleName = classifiedModuleName;
    result.moduleConfidence = moduleConfidence;

    if (config.autoSetPriority) {
      const priorityResult = await classifyPriority(ticket.title, ticket.description, ticket.priority);
      result.priority = priorityResult.priority;
      priorityReason = priorityResult.reasoning;
    } else {
      result.priority = ticket.priority;
      priorityReason = "AI priority recommendation is disabled in settings.";
    }

    const searchQuery = `${ticket.title} ${ticket.description ?? ""}`.trim();
    const kbMatches = await searchKnowledgeBase(searchQuery, {
      moduleId: classifiedModuleId ?? undefined,
      limit: 3,
    });

    if (kbMatches.length > 0) {
      const topMatch = kbMatches[0];
      const kbEval = await evaluateKbMatch(
        ticket.title,
        ticket.description,
        topMatch.title,
        topMatch.content,
      );

      if (kbEval.isRelevant) {
        result.replyConfidence = kbEval.confidence;
        result.suggestedReply = kbEval.suggestedReply;
        result.kbArticleId = topMatch.id;
        result.kbArticleTitle = topMatch.title;
      }
    }

    await db
      .update(tickets)
      .set({
        moduleId: classifiedModuleId ?? ticket.moduleId,
        moduleConfidence: confidenceToDb(moduleConfidence),
        moduleSetBy: classifiedModuleId && !ticket.moduleId ? "ai" : ticket.moduleId ? "user" : null,
        priority: result.priority,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticketId));

    await db.insert(aiSuggestions).values({
      ticketId,
      suggestedKbId: result.kbArticleId,
      confidenceScore: confidenceToDb(result.replyConfidence),
      wasHelpful: null,
    });

    const priorAutoReplies = await countAutoReplies(ticketId);

    const policy = canAutoReply(
      {
        priority: result.priority,
        suggestedReply: result.suggestedReply,
        replyConfidence: result.replyConfidence,
        kbArticleId: result.kbArticleId,
        ticketText: searchQuery,
        source: ticket.source,
        priorAutoReplies,
      },
      config,
    );

    autoReplyAllowed = policy.allowed;
    autoReplyBlockedReason = policy.blockedReason;

    if (policy.allowed && result.suggestedReply) {
      if (config.autoReplyDelayMinutes > 0) {
        // Hold the reply: queue a delayed job that re-checks for human
        // intervention before sending. The ticket is NOT marked as replied yet.
        await aiAutoReplyQueue.add(
          "auto-reply",
          {
            ticketId,
            content: result.suggestedReply,
            source: ticket.source,
            jid: ticket.waPhone ?? null,
            queuedAt: new Date().toISOString(),
          },
          { delay: config.autoReplyDelayMinutes * 60_000 },
        );
        autoReplyBlockedReason = `Scheduled to auto-send in ${config.autoReplyDelayMinutes} min unless an agent replies first.`;
      } else {
        await db.insert(ticketMessages).values({
          ticketId,
          senderId: null,
          senderType: "ai_agent",
          content: result.suggestedReply,
          isInternalNote: false,
          source: ticket.source,
        });

        if (ticket.source === "whatsapp" && ticket.waPhone) {
          await sendWhatsAppMessage(ticket.waPhone, result.suggestedReply);
        }

        result.autoReplied = true;
      }
    }

    await db.insert(triageEvents).values({
      ticketId,
      trigger,
      status: "completed",
      moduleId: result.moduleId,
      moduleName: result.moduleName,
      moduleConfidence: confidenceToDb(result.moduleConfidence),
      moduleReason,
      priority: result.priority,
      priorityReason,
      suggestedKbId: result.kbArticleId,
      suggestedKbTitle: result.kbArticleTitle,
      replyConfidence: confidenceToDb(result.replyConfidence),
      suggestedReply: result.suggestedReply,
      autoReplyAllowed,
      autoReplySent: result.autoReplied,
      autoReplyBlockedReason,
      model: AI_MODEL,
      error: null,
    });

    return result;
  } catch (error) {
    await db.insert(triageEvents).values({
      ticketId,
      trigger,
      status: "failed",
      moduleId: result.moduleId,
      moduleName: result.moduleName,
      moduleConfidence: confidenceToDb(result.moduleConfidence),
      priority: result.priority,
      suggestedKbId: result.kbArticleId,
      suggestedKbTitle: result.kbArticleTitle,
      replyConfidence: confidenceToDb(result.replyConfidence),
      suggestedReply: result.suggestedReply,
      autoReplyAllowed,
      autoReplySent: result.autoReplied,
      autoReplyBlockedReason,
      model: AI_MODEL,
      error: errorMessage(error),
    });

    console.error(`[AI] Triage failed for ticket ${ticketId}:`, error);
    return result;
  }
}
