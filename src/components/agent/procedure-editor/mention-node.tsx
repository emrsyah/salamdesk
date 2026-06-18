"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { Plugin } from "@tiptap/pm/state";
import type { MentionKind } from "@/lib/agent/procedure-content";

const KIND_STYLE: Record<MentionKind, string> = {
  tool: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  kb: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  module: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  time: "bg-slate-200 text-slate-700 dark:bg-slate-500/25 dark:text-slate-300",
};

const KIND_GLYPH: Record<MentionKind, string> = { tool: "⚙", kb: "📄", module: "▦", time: "🕘" };

function MentionChip(props: ReactNodeViewProps) {
  const kind = (props.node.attrs.kind as MentionKind) ?? "tool";
  const label = String(props.node.attrs.label ?? "");
  return (
    <NodeViewWrapper
      as="span"
      className={`mx-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 align-baseline text-[0.8125rem] font-medium ${KIND_STYLE[kind]}`}
      data-mention-kind={kind}
    >
      <span aria-hidden className="text-[0.7em] leading-none">
        {KIND_GLYPH[kind]}
      </span>
      {label}
    </NodeViewWrapper>
  );
}

export type MentionNodeOptions = {
  suggestion: Omit<SuggestionOptions, "editor">;
};

/**
 * A single inline atom node for every `/`-inserted reference. The `kind`
 * attribute (tool | kb | module | time) drives the chip color and how the
 * serializer/prompt-assembler interpret it. We persist JSON (not HTML), so
 * `getJSON()` round-trips through the `data-*` attrs below.
 */
export const Mention = Node.create<MentionNodeOptions>({
  name: "mention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return {
      suggestion: {
        char: "/",
        // The editor wires real `items`/`render`/`command` via configure().
      } as Omit<SuggestionOptions, "editor">,
    };
  },

  addAttributes() {
    return {
      kind: {
        default: "tool",
        parseHTML: (el) => el.getAttribute("data-kind"),
        renderHTML: (attrs) => ({ "data-kind": String(attrs.kind ?? "tool") }),
      },
      refId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-ref-id"),
        renderHTML: (attrs) => (attrs.refId ? { "data-ref-id": String(attrs.refId) } : {}),
      },
      label: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-label") ?? el.textContent,
        renderHTML: (attrs) => ({ "data-label": String(attrs.label ?? "") }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-mention]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes({ "data-mention": "" }, HTMLAttributes),
      `${KIND_GLYPH[(node.attrs.kind as MentionKind) ?? "tool"]} ${node.attrs.label ?? ""}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MentionChip);
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }) as unknown as Plugin,
    ];
  },
});
