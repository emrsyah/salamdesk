import type { ModelMessage } from "ai";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { ticketMessages } from "@/db/schema/tickets";

/**
 * Roughly one WhatsApp conversation's worth of context. Budgeted by characters
 * (≈4 chars/token) from the most recent end, so long threads stay bounded
 * without dropping the turns that matter — the recent ones.
 */
const DEFAULT_MAX_CHARS = 6000;

/** Recent requester-only turns kept for classification (module/priority/scope). */
const CLASSIFIER_MESSAGE_CAP = 5;

export type TicketConversation = {
  /**
   * Interleaved history as model messages (oldest → newest), with the agent's
   * own prior replies included as `assistant` turns. This is what gives the AI
   * memory — so it stops re-asking the same question or repeating answers.
   */
  messages: ModelMessage[];
  /** Most recent requester message — the current need, used for KB retrieval. */
  latestUserText: string;
  /** Recent requester-only text (last few), used by the lightweight classifiers. */
  requesterText: string;
};

type Turn = { role: "user" | "assistant"; text: string };

/**
 * Build the conversation context for a ticket from its non-internal messages.
 *
 * Requester messages map to `user`; AI/staff replies map to `assistant`. A
 * brand-new ticket may have no message rows yet (intake stores the first
 * message only on `tickets.description`), so `fallbackText` seeds a single user
 * turn in that case — callers should pass the ticket description/title.
 */
export async function buildTicketConversation(
  ticketId: string,
  opts?: { maxChars?: number; fallbackText?: string },
): Promise<TicketConversation> {
  const maxChars = opts?.maxChars ?? DEFAULT_MAX_CHARS;

  const rows = await db
    .select({
      content: ticketMessages.content,
      senderType: ticketMessages.senderType,
    })
    .from(ticketMessages)
    .where(
      and(eq(ticketMessages.ticketId, ticketId), eq(ticketMessages.isInternalNote, false)),
    )
    .orderBy(asc(ticketMessages.createdAt));

  const turns: Turn[] = rows
    .map((r) => ({
      role: r.senderType === "requester" ? ("user" as const) : ("assistant" as const),
      text: (r.content ?? "").trim(),
    }))
    .filter((t) => t.text.length > 0);

  // Seed from the ticket body when there are no message rows yet (fresh intake).
  if (turns.length === 0 && opts?.fallbackText?.trim()) {
    turns.push({ role: "user", text: opts.fallbackText.trim() });
  }

  // Keep the most recent turns within the character budget.
  const budgeted: Turn[] = [];
  let total = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    total += turns[i].text.length;
    budgeted.unshift(turns[i]);
    if (total >= maxChars) break;
  }

  // Merge consecutive same-role turns into one message so the history strictly
  // alternates roles — some providers reject two `user` (or two `assistant`)
  // messages in a row.
  const messages: ModelMessage[] = [];
  for (const turn of budgeted) {
    const last = messages[messages.length - 1];
    if (last && last.role === turn.role && typeof last.content === "string") {
      last.content = `${last.content}\n${turn.text}`;
    } else {
      messages.push({ role: turn.role, content: turn.text });
    }
  }

  const latestUserText =
    [...turns].reverse().find((t) => t.role === "user")?.text ?? opts?.fallbackText?.trim() ?? "";

  const requesterText =
    turns
      .filter((t) => t.role === "user")
      .slice(-CLASSIFIER_MESSAGE_CAP)
      .map((t) => t.text)
      .join("\n")
      .trim() || (opts?.fallbackText?.trim() ?? "");

  return { messages, latestUserText, requesterText };
}

/**
 * Append a dynamic block (e.g. a retrieved KB article) to the trailing user
 * turn, keeping role alternation intact. Dynamic content is deliberately kept
 * OUT of the system prompt so the stable system prefix stays cacheable
 * (Gemini implicit caching) — see triage-ai.service.
 */
export function withTrailingUser(
  conversation: ModelMessage[],
  dynamicBlock: string,
): ModelMessage[] {
  const messages = conversation.slice();
  const last = messages[messages.length - 1];
  if (last && last.role === "user" && typeof last.content === "string") {
    messages[messages.length - 1] = {
      role: "user",
      content: `${last.content}\n\n${dynamicBlock}`,
    };
  } else {
    messages.push({ role: "user", content: dynamicBlock });
  }
  return messages;
}
