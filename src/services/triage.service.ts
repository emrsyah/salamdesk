import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiSuggestions } from "@/db/schema/knowledge-base";
import { ticketMessages, tickets } from "@/db/schema/tickets";
import { triageEvents } from "@/db/schema/triage";
import { AI_MODEL } from "@/lib/ai";
import { aiAutoReplyQueue } from "@/lib/queue";
import { canAutoReply } from "@/services/auto-reply-policy.service";
import { getAiConfig } from "@/services/ai-config.service";
import { evaluateKbMatch, classifyModule, classifyPriority, classifyOnTopic } from "@/services/triage-ai.service";
import { searchKnowledgeBase } from "@/services/knowledge.service";
import { getAllModules } from "@/services/module.service";
import { tryProcedure } from "@/services/procedure-runtime.service";
import type { TicketPriority } from "@/services/ticket.service";
import { sendWhatsAppMessage } from "@/services/whatsapp.service";
import { getSlaDeadlines } from "@/services/ticket-sla.service";
import { resolveReplyMode } from "@/lib/agent/business-hours";

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
  /** Why the reply was/wasn't auto-sent (null when it was sent with no caveat). */
  autoReplyBlockedReason: string | null;
  suggestedReply: string | null;
  procedureId: string | null;
  procedureTitle: string | null;
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
      moduleSetBy: true,
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
    autoReplyBlockedReason: null,
    suggestedReply: null,
    procedureId: null,
    procedureTitle: null,
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
    result.autoReplyBlockedReason = "AI triage is disabled in settings.";
    return result;
  }

  let moduleReason: string | null = null;
  let priorityReason: string | null = null;
  let autoReplyAllowed: boolean | null = null;
  let autoReplyBlockedReason: string | null = null;

  try {
    const activeModules = await getAllModules({ activeOnly: true });

    // Ground triage on the full requester conversation, not just the first
    // message. `ticket.description` is frozen at creation, so follow-up
    // messages (message_added re-triage) were previously ignored.
    const requesterMessages = await db
      .select({ content: ticketMessages.content })
      .from(ticketMessages)
      .where(
        and(
          eq(ticketMessages.ticketId, ticketId),
          eq(ticketMessages.senderType, "requester"),
          eq(ticketMessages.isInternalNote, false),
        ),
      )
      .orderBy(asc(ticketMessages.createdAt));

    // Recent conversation for classification/scope (broad context, capped to
    // bound token cost on long threads); latest message for retrieval/reply
    // (the requester's current need).
    const RECENT_MESSAGE_CAP = 5;
    const conversationText =
      requesterMessages
        .slice(-RECENT_MESSAGE_CAP)
        .map((m) => m.content)
        .join("\n")
        .trim() || (ticket.description ?? "");
    const latestMessage =
      requesterMessages.at(-1)?.content?.trim() || ticket.description || ticket.title;

    let classifiedModuleId = ticket.moduleId;
    let classifiedModuleName: string | null = null;
    let moduleConfidence = 0;
    let moduleSetByAi = false;

    // Re-classify on follow-ups so a later question can move the ticket to a
    // different module instead of being stuck on the first message's context.
    // A module a human assigned is respected and never overridden.
    const isFollowUp = trigger === "message_added";
    const moduleLockedByUser = ticket.moduleId != null && ticket.moduleSetBy === "user";
    const shouldClassifyModule =
      config.autoClassifyModule &&
      activeModules.length > 0 &&
      !moduleLockedByUser &&
      (!ticket.moduleId || isFollowUp);

    if (shouldClassifyModule) {
      const moduleResult = await classifyModule(ticket.title, conversationText, activeModules);
      if (moduleResult.moduleId && moduleResult.confidence >= config.moduleConfidenceThreshold) {
        classifiedModuleId = moduleResult.moduleId;
        classifiedModuleName = moduleResult.moduleName;
        moduleConfidence = moduleResult.confidence;
        moduleReason = moduleResult.reasoning;
        moduleSetByAi = true;
      } else if (ticket.moduleId) {
        // Low-confidence on a follow-up: keep the module already in place.
        const moduleRow = activeModules.find((candidate) => candidate.id === ticket.moduleId);
        classifiedModuleName = moduleRow?.name ?? null;
        moduleConfidence = 1;
        moduleReason = `Below threshold on follow-up (${config.moduleConfidenceThreshold}); kept current module.`;
      } else {
        moduleConfidence = moduleResult.confidence;
        moduleReason = `Below module confidence threshold (${config.moduleConfidenceThreshold}); left unassigned.`;
      }
    } else if (ticket.moduleId) {
      const moduleRow = activeModules.find((candidate) => candidate.id === ticket.moduleId);
      classifiedModuleName = moduleRow?.name ?? null;
      moduleConfidence = 1;
      moduleReason = moduleLockedByUser
        ? "Module was set by a user; not overridden by AI."
        : "Module was already set before AI triage.";
    }

    result.moduleId = classifiedModuleId;
    result.moduleName = classifiedModuleName;
    result.moduleConfidence = moduleConfidence;

    if (config.autoSetPriority) {
      const priorityResult = await classifyPriority(ticket.title, conversationText, ticket.priority);
      result.priority = priorityResult.priority;
      priorityReason = priorityResult.reasoning;
    } else {
      result.priority = ticket.priority;
      priorityReason = "AI priority recommendation is disabled in settings.";
    }

    // Scope guard: clearly off-topic tickets must never be auto-answered.
    let offTopic = false;
    if (config.offTopicGuardEnabled) {
      const topic = await classifyOnTopic(ticket.title, conversationText, {
        persona: config.persona,
        guardrails: config.guardrails,
      });
      offTopic = !topic.onTopic;
      if (offTopic) moduleReason = moduleReason ?? topic.reasoning;
    }

    // Retrieve against the requester's CURRENT message only. Including the
    // ticket title (the first message) biased follow-ups back to the original
    // topic — e.g. a billing-titled ticket kept surfacing billing KB when the
    // latest question was about queues.
    const searchQuery = latestMessage.trim();
    const kbMatches = await searchKnowledgeBase(searchQuery, {
      moduleId: classifiedModuleId ?? undefined,
      // Cross-module search ranks purely by relevance so a misclassified module
      // can't hide the right article; module-scoped restricts to the classified
      // module (higher precision when classification is reliable).
      scope: config.kbCrossModuleSearch ? "all" : "module",
      limit: 3,
    });

    if (kbMatches.length > 0) {
      const topMatch = kbMatches[0];
      const kbEval = await evaluateKbMatch(
        ticket.title,
        latestMessage,
        topMatch.title,
        topMatch.content,
        {
          agentName: config.agentName,
          persona: config.persona,
          tone: config.tone,
          language: config.language,
          replySignature: config.replySignature,
          guardrails: config.guardrails,
        },
      );

      if (kbEval.isRelevant) {
        result.replyConfidence = kbEval.confidence;
        result.suggestedReply = kbEval.suggestedReply;
        result.kbArticleId = topMatch.id;
        result.kbArticleTitle = topMatch.title;
      }
    }

    // If AI just assigned a module for the first time (ticket came in without one,
    // e.g. from WhatsApp), recalculate SLA deadlines now that we know the module.
    // Tickets created with a moduleId already have correct deadlines from createTicket.
    let slaUpdate: {
      firstResponseDueAt: Date | null;
      resolutionDueAt: Date | null;
      slaDeadlineAt: Date | null;
    } | null = null;

    if (classifiedModuleId && !ticket.moduleId) {
      const ticketRow = await db.query.tickets.findFirst({
        where: eq(tickets.id, ticketId),
        columns: { createdAt: true },
      });
      if (ticketRow) {
        const { firstResponseDueAt, resolutionDueAt } = await getSlaDeadlines({
          moduleId: classifiedModuleId,
          priority: result.priority,
          createdAt: ticketRow.createdAt,
        });
        slaUpdate = {
          firstResponseDueAt,
          resolutionDueAt,
          slaDeadlineAt: resolutionDueAt,
        };
        console.log(
          `[TRIAGE] Backfilled SLA for ticket ${ticketId}: firstResponse=${firstResponseDueAt?.toISOString()}, resolution=${resolutionDueAt?.toISOString()}`,
        );
      }
    }

    // --- Procedure attempt (additive; falls back to the KB suggestion on no match) ---
    let procedureForceDraft = false;
    try {
      const proc = await tryProcedure({
        ticketText: searchQuery,
        moduleName: classifiedModuleName,
        behavior: {
          agentName: config.agentName,
          persona: config.persona,
          tone: config.tone,
          language: config.language,
          replySignature: config.replySignature,
          guardrails: config.guardrails,
        },
        minConfidence: config.procedureConfidenceThreshold,
      });
      if (proc && proc.reply) {
        result.suggestedReply = proc.reply;
        result.replyConfidence = proc.confidence;
        result.procedureId = proc.procedureId;
        result.procedureTitle = proc.procedureTitle;
        // Guardrail: a procedure that escalates or hit a failed tool must never auto-send.
        if (proc.action !== "send") procedureForceDraft = true;
      }
    } catch (procErr) {
      // Never let a procedure failure break triage — fall back to the KB suggestion.
      console.error(`[AI] Procedure attempt failed for ticket ${ticketId}:`, procErr);
    }

    // These two writes and the prior-reply count are independent of each other.
    const [, , priorAutoReplies] = await Promise.all([
      db
        .update(tickets)
        .set({
          moduleId: classifiedModuleId ?? ticket.moduleId,
          moduleConfidence: confidenceToDb(moduleConfidence),
          // Preserve a user-set module; mark AI when this run (re)classified it.
          moduleSetBy: moduleSetByAi ? "ai" : (ticket.moduleSetBy ?? (classifiedModuleId ? "ai" : null)),
          priority: result.priority,
          updatedAt: new Date(),
          // Backfill SLA deadlines if this is the first time a module is assigned.
          ...(slaUpdate ?? {}),
        })
        .where(eq(tickets.id, ticketId)),
      db.insert(aiSuggestions).values({
        ticketId,
        suggestedKbId: result.kbArticleId,
        confidenceScore: confidenceToDb(result.replyConfidence),
        wasHelpful: null,
      }),
      countAutoReplies(ticketId),
    ]);

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

    if (procedureForceDraft) {
      autoReplyBlockedReason =
        autoReplyBlockedReason ?? "Prosedur meminta draf saja (eskalasi atau tool gagal).";
    }

    if (offTopic) {
      autoReplyBlockedReason =
        autoReplyBlockedReason ?? "Pesan di luar topik layanan SIMRS — disiapkan sebagai draf untuk staf.";
    }

    if (policy.allowed && result.suggestedReply && !procedureForceDraft && !offTopic) {
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

    // Off-hours acknowledgment: if the real reply was withheld because we're
    // outside business hours, send a one-time courtesy message so the requester
    // isn't left in silence. The actual answer remains a draft for staff.
    const isOffHours =
      !!config.businessHours && resolveReplyMode(config.businessHours, new Date()) === "draft-only";
    if (
      !result.autoReplied &&
      isOffHours &&
      config.offHoursReplyEnabled &&
      config.offHoursMessage.trim() &&
      config.autoReplyChannels.includes(ticket.source) &&
      priorAutoReplies === 0 // only once per ticket — don't repeat on follow-ups
    ) {
      const offHoursText = config.offHoursMessage.trim();
      await db.insert(ticketMessages).values({
        ticketId,
        senderId: null,
        senderType: "ai_agent",
        content: offHoursText,
        isInternalNote: false,
        source: ticket.source,
      });
      if (ticket.source === "whatsapp" && ticket.waPhone) {
        await sendWhatsAppMessage(ticket.waPhone, offHoursText);
      }
      autoReplyBlockedReason =
        autoReplyBlockedReason ?? "Di luar jam operasional — kirim pesan otomatis di luar jam & draf untuk staf.";
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

    result.autoReplyBlockedReason = autoReplyBlockedReason;
    return result;
  } catch (error) {
    // Best-effort failure record — never let the logging insert mask (or
    // suppress the re-throw of) the original error.
    try {
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
    } catch (logErr) {
      console.error(`[AI] Failed to record triage failure for ticket ${ticketId}:`, logErr);
    }

    console.error(`[AI] Triage failed for ticket ${ticketId}:`, error);
    // Re-throw so the BullMQ worker marks the job failed and retries it per the
    // queue's `attempts`/`backoff` config (transient DB/AI errors recover).
    throw error;
  }
}
