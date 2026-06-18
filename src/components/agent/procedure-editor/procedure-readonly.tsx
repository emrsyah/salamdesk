"use client";

import { Fragment, type ReactNode } from "react";
import type { MentionKind, ProseNode } from "@/lib/agent/procedure-content";

const KIND_STYLE: Record<MentionKind, string> = {
  tool: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  kb: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  module: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  time: "bg-slate-200 text-slate-700 dark:bg-slate-500/25 dark:text-slate-300",
};
const KIND_GLYPH: Record<MentionKind, string> = { tool: "⚙", kb: "📄", module: "▦", time: "🕘" };

function MentionChip({ node }: { node: ProseNode }) {
  const kind = (node.attrs?.kind as MentionKind) ?? "tool";
  const label = String(node.attrs?.label ?? "");
  return (
    <span className={`mx-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.8125rem] font-medium ${KIND_STYLE[kind]}`}>
      <span aria-hidden className="text-[0.7em] leading-none">
        {KIND_GLYPH[kind]}
      </span>
      {label}
    </span>
  );
}

function renderInline(nodes: ProseNode[] | undefined): ReactNode {
  if (!nodes) return null;
  return nodes.map((n, i) => {
    if (n.type === "text") return <Fragment key={i}>{n.text}</Fragment>;
    if (n.type === "mention") return <MentionChip key={i} node={n} />;
    if (n.type === "hardBreak") return <br key={i} />;
    return <Fragment key={i}>{renderInline(n.content)}</Fragment>;
  });
}

function renderBlock(node: ProseNode, i: number): ReactNode {
  switch (node.type) {
    case "orderedList":
      return (
        <ol key={i} className="ml-5 list-decimal space-y-1">
          {node.content?.map((li, j) => renderBlock(li, j))}
        </ol>
      );
    case "bulletList":
      return (
        <ul key={i} className="ml-5 list-disc space-y-1">
          {node.content?.map((li, j) => renderBlock(li, j))}
        </ul>
      );
    case "listItem":
      return <li key={i}>{node.content?.map((c, j) => renderBlock(c, j))}</li>;
    case "paragraph":
      return <p key={i}>{renderInline(node.content)}</p>;
    default:
      return <Fragment key={i}>{node.content?.map((c, j) => renderBlock(c, j))}</Fragment>;
  }
}

/** Non-editable render of a procedure doc (list/preview). Mirrors the editor's chips. */
export function ProcedureReadonly({ content }: { content: ProseNode | null | undefined }) {
  if (!content || typeof content !== "object") return null;
  return <div className="space-y-2 text-sm leading-relaxed">{content.content?.map((n, i) => renderBlock(n, i))}</div>;
}
