import type { TicketPriority } from "@/services/ticket.service";
import type { AiConfig } from "@/services/ai-config.service";

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
};

export type AutoReplyPolicyDecision = {
  allowed: boolean;
  blockedReason: string | null;
};

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

  if (config.requireKbGrounding && !input.kbArticleId) {
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

  return { allowed: true, blockedReason: null };
}
