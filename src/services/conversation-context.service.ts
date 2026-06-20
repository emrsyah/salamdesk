import type { ModelMessage } from "ai";
import { and, eq } from "drizzle-orm";
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
   * own prior replies included as `assistant` turns and inbound images as image
   * file-parts on `user` turns. This is what gives the AI memory + vision.
   */
  messages: ModelMessage[];
  /** Most recent requester message text — the current need, used for retrieval. */
  latestUserText: string;
  /** Images on the most recent requester message (for the vision pre-pass). */
  latestImages: Img[];
  /** Recent requester-only text (last few), used by the lightweight classifiers. */
  requesterText: string;
};

export type Img = { url: string; mediaType: string; data?: Uint8Array };
type Turn = { role: "user" | "assistant"; text: string; images: Img[] };

/**
 * Fetch image bytes so we can send them INLINE to the LLM rather than as a URL.
 * Passing a URL makes the model provider fetch it server-side, which fails for
 * any host with hotlink protection — sending bytes is provider/host-agnostic.
 * Best-effort: returns null on failure (caller falls back to the URL).
 */
async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Build the conversation context for a ticket from its non-internal messages.
 *
 * Requester messages map to `user`; AI/staff replies map to `assistant`. Inbound
 * image attachments become image file-parts on their user turn so a vision model
 * can see them. A brand-new ticket may have no message rows yet, so
 * `fallbackText` seeds a single user turn — callers should pass the ticket body.
 */
export async function buildTicketConversation(
  ticketId: string,
  opts?: { maxChars?: number; fallbackText?: string },
): Promise<TicketConversation> {
  const maxChars = opts?.maxChars ?? DEFAULT_MAX_CHARS;

  const rows = await db.query.ticketMessages.findMany({
    where: and(
      eq(ticketMessages.ticketId, ticketId),
      eq(ticketMessages.isInternalNote, false),
    ),
    orderBy: (fields, { asc }) => [asc(fields.createdAt)],
    columns: { content: true, senderType: true },
    with: { attachments: { columns: { fileUrl: true, mimeType: true } } },
  });

  const turns: Turn[] = rows
    .map((r) => {
      const role: Turn["role"] = r.senderType === "requester" ? "user" : "assistant";
      const images: Img[] = (r.attachments ?? [])
        .filter((a) => a.mimeType?.startsWith("image/"))
        .map((a) => ({ url: a.fileUrl, mediaType: a.mimeType }));
      let text = (r.content ?? "").trim();
      // Drop the "[Gambar]" placeholder when the real image is attached — the
      // image part already conveys it.
      if (images.length > 0 && text === "[Gambar]") text = "";
      return { role, text, images };
    })
    .filter((t) => t.text.length > 0 || t.images.length > 0);

  // Seed from the ticket body when there are no message rows yet (fresh intake).
  if (turns.length === 0 && opts?.fallbackText?.trim()) {
    turns.push({ role: "user", text: opts.fallbackText.trim(), images: [] });
  }

  // Keep the most recent turns within the character budget (images count as 0).
  const budgeted: Turn[] = [];
  let total = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    total += turns[i].text.length;
    budgeted.unshift(turns[i]);
    if (total >= maxChars) break;
  }

  // Merge consecutive same-role turns so the history strictly alternates roles —
  // some providers reject two `user` (or two `assistant`) messages in a row.
  const merged: Turn[] = [];
  for (const turn of budgeted) {
    const last = merged[merged.length - 1];
    if (last && last.role === turn.role) {
      last.text = last.text ? `${last.text}\n${turn.text}`.trim() : turn.text;
      last.images.push(...turn.images);
    } else {
      merged.push({ role: turn.role, text: turn.text, images: [...turn.images] });
    }
  }

  // Fetch bytes for every in-budget image once, in parallel, and attach them to
  // the shared Img objects (so latestImages/describeImages reuse them — no
  // re-fetch across the 3+ LLM calls a triage makes).
  const imagesInBudget = merged.flatMap((t) => (t.role === "user" ? t.images : []));
  await Promise.all(
    [...new Set(imagesInBudget.map((i) => i.url))].map(async (url) => {
      const bytes = await fetchImageBytes(url);
      if (bytes) for (const img of imagesInBudget) if (img.url === url) img.data = bytes;
    }),
  );

  const messages: ModelMessage[] = merged.map((turn) => {
    // Images ride on user turns only — assistant image parts are unusual and
    // unnecessary (the agent's own sent images don't need re-describing).
    if (turn.role === "user" && turn.images.length > 0) {
      return {
        role: "user",
        content: [
          ...(turn.text ? [{ type: "text" as const, text: turn.text }] : []),
          ...turn.images.map((img) => ({
            type: "file" as const,
            mediaType: img.mediaType,
            data: img.data ?? new URL(img.url),
          })),
        ],
      };
    }
    return { role: turn.role, content: turn.text || "[Gambar]" };
  });

  const lastUserTurn = [...turns].reverse().find((t) => t.role === "user");
  const latestUserText = lastUserTurn?.text ?? opts?.fallbackText?.trim() ?? "";
  const latestImages = lastUserTurn?.images ?? [];

  const requesterText =
    turns
      .filter((t) => t.role === "user")
      .slice(-CLASSIFIER_MESSAGE_CAP)
      .map((t) => t.text)
      .filter(Boolean)
      .join("\n")
      .trim() || (opts?.fallbackText?.trim() ?? "");

  return { messages, latestUserText, latestImages, requesterText };
}

/**
 * Strip image file-parts from user messages, collapsing array content to plain
 * text (or "[Gambar]" when there's no text). Use before passing conversation
 * history to generateObject callers — multimodal content inside structured-output
 * requests is rejected by some providers. The vision pre-pass already produced
 * text descriptions for classifiers; reply generators only need the text thread.
 */
export function stripImages(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((msg) => {
    if (msg.role === "user" && Array.isArray(msg.content)) {
      const text = (msg.content as { type: string; text?: string }[])
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("\n")
        .trim();
      return { role: "user" as const, content: text || "[Gambar]" };
    }
    return msg;
  });
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
  if (last && last.role === "user") {
    if (typeof last.content === "string") {
      messages[messages.length - 1] = {
        role: "user",
        content: `${last.content}\n\n${dynamicBlock}`,
      };
      return messages;
    }
    if (Array.isArray(last.content)) {
      messages[messages.length - 1] = {
        role: "user",
        content: [...last.content, { type: "text", text: dynamicBlock }],
      };
      return messages;
    }
  }
  messages.push({ role: "user", content: dynamicBlock });
  return messages;
}
