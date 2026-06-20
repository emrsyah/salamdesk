import { and, count, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { aiSuggestions } from "@/db/schema/knowledge-base";
import { ticketMessages, tickets } from "@/db/schema/tickets";
import { triageEvents } from "@/db/schema/triage";
import { AI_MODEL } from "@/lib/ai";
import { aiAutoReplyQueue } from "@/lib/queue";
import { canAutoReply, OFF_HOURS_BLOCKED_REASON } from "@/services/auto-reply-policy.service";
import { getAiConfig } from "@/services/ai-config.service";
import {
  evaluateKbMatch,
  classifyModule,
  classifyPriority,
  classifyOnTopic,
  generateClarifyingReply,
} from "@/services/triage-ai.service";
import { searchKnowledgeBase } from "@/services/knowledge.service";
import { buildTicketConversation } from "@/services/conversation-context.service";
import { getAllModules } from "@/services/module.service";
import { tryProcedure } from "@/services/procedure-runtime.service";
import type { TicketPriority } from "@/services/ticket.service";
import { sendWhatsAppMessage } from "@/services/whatsapp.service";
import { getSlaDeadlines } from "@/services/ticket-sla.service";
import { publishTicketEvent } from "@/lib/realtime";

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

/**
 * Idempotency guard for the auto-reply side effects. triageTicket re-throws on
 * error, so BullMQ re-runs the whole job (re-classifying via the AI and possibly
 * producing slightly different reply text) — a content match isn't reliable.
 * Instead we ask: has an AI reply already gone out *for the current inbound
 * message*? If so, a prior attempt already sent it and we must not send again.
 * A genuine follow-up adds a newer requester message, so the next reply is still
 * allowed.
 */
async function autoReplyAlreadySentForLatestInbound(ticketId: string): Promise<boolean> {
  const [lastInbound] = await db
    .select({ createdAt: ticketMessages.createdAt })
    .from(ticketMessages)
    .where(
      and(
        eq(ticketMessages.ticketId, ticketId),
        eq(ticketMessages.senderType, "requester"),
        eq(ticketMessages.isInternalNote, false),
      ),
    )
    .orderBy(desc(ticketMessages.createdAt))
    .limit(1);
  if (!lastInbound) return false;

  const [aiReplyAfter] = await db
    .select({ id: ticketMessages.id })
    .from(ticketMessages)
    .where(
      and(
        eq(ticketMessages.ticketId, ticketId),
        eq(ticketMessages.senderType, "ai_agent"),
        eq(ticketMessages.isInternalNote, false),
        gt(ticketMessages.createdAt, lastInbound.createdAt),
      ),
    )
    .limit(1);
  return !!aiReplyAfter;
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

  // Mark triage as in-flight so the inbox can show a live "menganalisis…" state
  // and survive a page reload mid-run. A terminal event row (completed / failed
  // / skipped) is always written below and wins by recency, so this processing
  // row never lingers as the latest event.
  await db.insert(triageEvents).values({
    ticketId,
    trigger,
    status: "processing",
    priority: ticket.priority,
    model: AI_MODEL,
  });
  await publishTicketEvent({ type: "triage:started", ticketId });

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

    // Ground triage on the full conversation, not just the first message.
    // `conversation.messages` is the interleaved thread (incl. the agent's own
    // prior replies) used for reply generation so the AI has memory;
    // `requesterText` is recent requester-only text for the lightweight
    // classifiers; `latestUserText` is the current need, used for retrieval.
    const conversation = await buildTicketConversation(ticketId, {
      fallbackText: ticket.description ?? ticket.title,
    });
    const conversationText = conversation.requesterText;
    const latestMessage = conversation.latestUserText || ticket.title;

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

    // Fire the three independent LLM classifiers concurrently. Each depends only
    // on the ticket text, not on one another, so running them in parallel cuts
    // two round-trips of wall-clock latency off the pipeline. KB retrieval below
    // depends on the module result, so it stays sequential after this barrier.
    const [moduleResult, priorityResult, topic] = await Promise.all([
      shouldClassifyModule
        ? classifyModule(ticket.title, conversationText, activeModules)
        : Promise.resolve(null),
      config.autoSetPriority
        ? classifyPriority(ticket.title, conversationText, ticket.priority)
        : Promise.resolve(null),
      config.offTopicGuardEnabled
        ? classifyOnTopic(ticket.title, conversationText, {
            persona: config.persona,
            guardrails: config.guardrails,
          })
        : Promise.resolve(null),
    ]);

    if (shouldClassifyModule && moduleResult) {
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

    if (config.autoSetPriority && priorityResult) {
      result.priority = priorityResult.priority;
      priorityReason = priorityResult.reasoning;
    } else {
      result.priority = ticket.priority;
      priorityReason = "AI priority recommendation is disabled in settings.";
    }

    // Scope guard: clearly off-topic tickets must never be auto-answered.
    let offTopic = false;
    if (config.offTopicGuardEnabled && topic) {
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
      const kbEval = await evaluateKbMatch({
        conversation: conversation.messages,
        ticketTitle: ticket.title,
        kbTitle: topMatch.title,
        kbContent: topMatch.content,
        behavior: {
          agentName: config.agentName,
          persona: config.persona,
          tone: config.tone,
          language: config.language,
          replySignature: config.replySignature,
          guardrails: config.guardrails,
        },
      });

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
    // Skipped entirely when procedures are turned off, which also removes the
    // router + execution LLM round-trips from the triage critical path.
    let procedureForceDraft = false;
    if (config.proceduresEnabled) try {
      const proc = await tryProcedure({
        ticketText: searchQuery,
        moduleName: classifiedModuleName,
        conversation: conversation.messages,
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

    // --- AI-first fallback ---------------------------------------------------
    // Nothing matched (no relevant KB article, no procedure) but AI-first mode is
    // on and the message is on-topic: generate a friendly clarifying/follow-up
    // reply so the agent always responds (e.g. to a bare "Halo"). The clarifier
    // is not KB-grounded, so it carries the aiFirstReply flag to skip only that
    // gate; all other auto-reply gates still apply.
    let aiFirstReply = false;
    if (config.aiFirstMode && !result.suggestedReply && !offTopic) {
      try {
        const clarifier = await generateClarifyingReply({
          conversation: conversation.messages,
          ticketTitle: ticket.title,
          behavior: {
            agentName: config.agentName,
            persona: config.persona,
            tone: config.tone,
            language: config.language,
            replySignature: config.replySignature,
            guardrails: config.guardrails,
          },
        });
        if (clarifier) {
          result.suggestedReply = clarifier;
          // High confidence: asking for clarification is always a safe action.
          result.replyConfidence = 0.9;
          aiFirstReply = true;
        }
      } catch (clarErr) {
        console.error(`[AI] Clarifying reply failed for ticket ${ticketId}:`, clarErr);
      }
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

    // One clock for the whole decision so the auto-reply gate and the off-hours
    // gate can't disagree on a run that straddles the business-hours boundary.
    const now = new Date();
    const policyInput = {
      priority: result.priority,
      suggestedReply: result.suggestedReply,
      replyConfidence: result.replyConfidence,
      kbArticleId: result.kbArticleId,
      ticketText: searchQuery,
      source: ticket.source,
      priorAutoReplies,
      aiFirstReply,
    };
    const policy = canAutoReply(policyInput, config, now);

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
        // jobId keyed on the current reply count makes a triage retry idempotent —
        // re-adding the same delayed job is a no-op.
        await aiAutoReplyQueue.add(
          "auto-reply",
          {
            ticketId,
            content: result.suggestedReply,
            source: ticket.source,
            jid: ticket.waPhone ?? null,
            queuedAt: new Date().toISOString(),
          },
          {
            delay: config.autoReplyDelayMinutes * 60_000,
            jobId: `auto-reply-${ticketId}-${priorAutoReplies}`,
          },
        );
        autoReplyBlockedReason = `Scheduled to auto-send in ${config.autoReplyDelayMinutes} min unless an agent replies first.`;
      } else if (await autoReplyAlreadySentForLatestInbound(ticketId)) {
        // A prior (later-failed) attempt already delivered this reply — don't
        // double-send on retry.
        result.autoReplied = true;
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
          await sendWhatsAppMessage(ticket.waPhone, result.suggestedReply, { typing: true });
        }

        result.autoReplied = true;
      }
    }

    // Off-hours acknowledgment: only when we have a valid answer that is withheld
    // *solely because we're outside business hours* — never for replies held back
    // for content/policy reasons (blocked keyword, low confidence, critical,
    // off-topic, procedure draft), which must not get an automated reply at all.
    // The business-hours gate is the last check in canAutoReply, so this exact
    // blocked reason means every content/policy gate passed and the answer is
    // held purely because it's after hours — the only case the courtesy applies.
    const withheldOnlyForHours =
      !procedureForceDraft && !offTopic && policy.blockedReason === OFF_HOURS_BLOCKED_REASON;
    if (
      !result.autoReplied &&
      withheldOnlyForHours &&
      config.offHoursReplyEnabled &&
      config.offHoursMessage.trim() &&
      config.autoReplyChannels.includes(ticket.source) &&
      priorAutoReplies === 0 && // only once per ticket — don't repeat on follow-ups
      !(await autoReplyAlreadySentForLatestInbound(ticketId)) // idempotent across retries
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
        await sendWhatsAppMessage(ticket.waPhone, offHoursText, { typing: true });
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
