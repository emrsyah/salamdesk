import { AI_CONFIDENCE_THRESHOLD } from "@/lib/ai";
import type { TicketPriority } from "@/services/ticket.service";

const RISKY_PATTERNS = [
  /\bhapus\b/i,
  /\bdelete\b/i,
  /\breset\b/i,
  /\bubah data\b/i,
  /\bkoreksi\b/i,
  /\bbilling\b/i,
  /\btagihan\b/i,
  /\bpembayaran\b/i,
  /\bpasien\b/i,
  /\bdiagnosa\b/i,
  /\bresep\b/i,
  /\bobat\b/i,
  /\bdown\b/i,
  /\berror massal\b/i,
];

export type AutoReplyPolicyInput = {
  priority: TicketPriority;
  suggestedReply: string | null;
  replyConfidence: number;
  kbArticleId: string | null;
  ticketText: string;
};

export type AutoReplyPolicyDecision = {
  allowed: boolean;
  blockedReason: string | null;
};

export function canAutoReply(input: AutoReplyPolicyInput): AutoReplyPolicyDecision {
  if (!input.suggestedReply) {
    return { allowed: false, blockedReason: "No suggested reply was generated." };
  }

  if (!input.kbArticleId) {
    return { allowed: false, blockedReason: "No KB article supports the reply." };
  }

  if (input.replyConfidence < AI_CONFIDENCE_THRESHOLD) {
    return {
      allowed: false,
      blockedReason: `Reply confidence is below ${AI_CONFIDENCE_THRESHOLD}.`,
    };
  }

  if (input.priority === "critical") {
    return { allowed: false, blockedReason: "Critical tickets require staff review." };
  }

  if (RISKY_PATTERNS.some((pattern) => pattern.test(input.ticketText))) {
    return {
      allowed: false,
      blockedReason: "Ticket contains risky healthcare, billing, data-change, or outage terms.",
    };
  }

  return { allowed: true, blockedReason: null };
}
