export const PROCEDURE_MENTION_KINDS = ["tool", "kb", "module", "time"] as const;
export type MentionKind = (typeof PROCEDURE_MENTION_KINDS)[number];

export type MentionAttrs = { kind: MentionKind; refId: string | null; label: string };

// Minimal structural type for a ProseMirror/TipTap JSON node. We only read it.
export type ProseNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: ProseNode[];
};
export type ProcedureContent = ProseNode;

export function emptyProcedureContent(): ProcedureContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

function isMention(node: ProseNode): node is ProseNode & { attrs: MentionAttrs } {
  return (
    node.type === "mention" &&
    typeof node.attrs?.kind === "string" &&
    (PROCEDURE_MENTION_KINDS as readonly string[]).includes(node.attrs.kind as string)
  );
}

/** Depth-first list of every mention node's attrs, in document order. */
export function extractMentions(content: ProcedureContent | null | undefined): MentionAttrs[] {
  const out: MentionAttrs[] = [];
  const walk = (node?: ProseNode) => {
    if (!node || typeof node !== "object") return;
    if (isMention(node)) {
      out.push({
        kind: node.attrs.kind,
        refId: (node.attrs.refId as string | null) ?? null,
        label: String(node.attrs.label ?? ""),
      });
    }
    node.content?.forEach(walk);
  };
  walk(content ?? undefined);
  return out;
}

/** Unique, non-null refIds of one kind, in first-seen order. */
export function collectRefIds(content: ProcedureContent | null | undefined, kind: MentionKind): string[] {
  const seen = new Set<string>();
  for (const m of extractMentions(content)) {
    if (m.kind === kind && m.refId) seen.add(m.refId);
  }
  return [...seen];
}

const KIND_LABEL: Record<MentionKind, string> = {
  tool: "Tool",
  kb: "KB",
  module: "Module",
  time: "Time",
};

function mentionToken(attrs: MentionAttrs): string {
  // `module`/`time` have no label of their own → just the kind tag.
  if (attrs.kind === "module") return "[Module]";
  if (attrs.kind === "time") return "[Current time]";
  return `[${KIND_LABEL[attrs.kind]}: ${attrs.label}]`;
}

function inlineText(nodes: ProseNode[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((n) => {
      if (n.type === "text") return n.text ?? "";
      if (isMention(n))
        return mentionToken({
          kind: n.attrs.kind,
          refId: (n.attrs.refId as string) ?? null,
          label: String(n.attrs.label ?? ""),
        });
      return inlineText(n.content);
    })
    .join("");
}

/**
 * Flatten a procedure doc into plain text for prompt assembly + read-only
 * fallbacks. Ordered-list items are numbered; paragraphs are newline-separated.
 * Mentions become readable tokens (e.g. "[Tool: Get order info]"). Never throws.
 */
export function serializeContentToText(content: ProcedureContent | null | undefined): string {
  if (!content || typeof content !== "object") return "";
  const lines: string[] = [];
  const renderBlock = (node: ProseNode, listIndex?: number) => {
    switch (node.type) {
      case "orderedList": {
        node.content?.forEach((li, i) => renderBlock(li, i + 1));
        return;
      }
      case "bulletList": {
        node.content?.forEach((li) => renderBlock(li));
        return;
      }
      case "listItem": {
        const inner = (node.content ?? []).map((c) => inlineText(c.content)).join(" ").trim();
        if (inner) lines.push(listIndex ? `${listIndex}. ${inner}` : `- ${inner}`);
        return;
      }
      case "paragraph": {
        const t = inlineText(node.content).trim();
        if (t) lines.push(t);
        return;
      }
      default:
        node.content?.forEach((c) => renderBlock(c));
    }
  };
  (content.content ?? []).forEach((n) => renderBlock(n));
  return lines.join("\n");
}
