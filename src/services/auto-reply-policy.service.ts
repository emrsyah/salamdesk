import type { TicketPriority } from "@/services/ticket.service";
import type { AiConfig } from "@/services/ai-config.service";
import { resolveReplyMode } from "@/lib/agent/business-hours";

export type AutoReplyPolicyInput = {
  priority: TicketPriority;
  suggestedReply: string | null;
  replyConfidence: number;
  kbArticleId: string | null;
  ticketText: string;
  // Ticket source ("whatsapp" | "web" | ...). Auto-reply only fires for the
  // channels enabled in config.
  source: string;
  // How many AI auto-replies this ticket already received.
  priorAutoReplies: number;
  // True when the reply is an AI-first clarifier (no KB article, intentionally).
  // Such replies skip the KB-grounding requirement — they exist precisely to ask
  // the requester for more detail — but still honour every other gate.
  aiFirstReply?: boolean;
};

export type AutoReplyPolicyDecision = {
  allowed: boolean;
  blockedReason: string | null;
};

/**
 * Blocked reason emitted when the *only* thing stopping an auto-reply is that
 * we're outside business hours. Because the business-hours gate runs last in
 * canAutoReply, seeing this reason means every content/policy gate passed — so
 * it's the signal that a valid answer is being held purely for the clock (used
 * by the off-hours courtesy message).
 */
export const OFF_HOURS_BLOCKED_REASON = "Outside auto-reply hours — drafted for staff review.";

/** Build a whole-word, case-insensitive matcher for a blocked keyword. */
function keywordMatches(keyword: string, text: string): boolean {
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return false;
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

/**
 * Decide whether an AI-drafted reply may be auto-sent, given the org's AI
 * behaviour config. All gates are configurable; nothing is hardcoded.
 */
export function canAutoReply(
  input: AutoReplyPolicyInput,
  config: AiConfig,
  now: Date = new Date(),
): AutoReplyPolicyDecision {
  if (!config.autoReplyEnabled) {
    return { allowed: false, blockedReason: "Auto-reply is disabled in settings." };
  }

  if (!config.autoReplyChannels.includes(input.source)) {
    return { allowed: false, blockedReason: `Auto-reply is disabled for ${input.source}.` };
  }

  if (input.priorAutoReplies >= config.maxAutoRepliesPerTicket) {
    return {
      allowed: false,
      blockedReason: `Ticket already reached the auto-reply limit (${config.maxAutoRepliesPerTicket}).`,
    };
  }

  if (!input.suggestedReply) {
    return { allowed: false, blockedReason: "No suggested reply was generated." };
  }

  if (config.requireKbGrounding && !input.kbArticleId && !input.aiFirstReply) {
    return { allowed: false, blockedReason: "No KB article supports the reply." };
  }

  if (input.replyConfidence < config.replyConfidenceThreshold) {
    return {
      allowed: false,
      blockedReason: `Reply confidence is below ${config.replyConfidenceThreshold}.`,
    };
  }

  if (config.skipCriticalPriority && input.priority === "critical") {
    return { allowed: false, blockedReason: "Critical tickets require staff review." };
  }

  const matched = config.blockedKeywords.find((kw) => keywordMatches(kw, input.ticketText));
  if (matched) {
    return {
      allowed: false,
      blockedReason: `Ticket contains a blocked keyword ("${matched}").`,
    };
  }

  if (config.businessHours && resolveReplyMode(config.businessHours, now) === "draft-only") {
    return {
      allowed: false,
      blockedReason: OFF_HOURS_BLOCKED_REASON,
    };
  }

  return { allowed: true, blockedReason: null };
}
