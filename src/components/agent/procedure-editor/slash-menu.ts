import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions, SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { SlashMenuList, type SlashMenuListHandle, type SlashAction } from "./slash-menu-list";
import type { MentionSource } from "@/services/agent-mention-sources.service";

/**
 * Build the `/` slash-menu Suggestion config for the Mention node. `getSources`
 * is read lazily so the menu reflects the latest tools/KB list; the create-*
 * callbacks let the page route to the Tools / KB creation flows.
 */
export function makeSlashSuggestion(opts: {
  getSources: () => MentionSource[];
  onCreateTool: () => void;
  onCreateKb: () => void;
}): Omit<SuggestionOptions<MentionSource, SlashAction>, "editor"> {
  return {
    char: "/",
    items: ({ query }) => {
      const q = query.toLowerCase();
      return opts.getSources().filter((s) => s.label.toLowerCase().includes(q));
    },
    command: ({ editor, range, props }) => {
      const action = props;
      if (action.type === "create-tool" || action.type === "create-kb") {
        editor.chain().focus().deleteRange(range).run();
        if (action.type === "create-tool") opts.onCreateTool();
        else opts.onCreateKb();
        return;
      }
      const s = action.source;
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent([
          { type: "mention", attrs: { kind: s.kind, refId: s.refId, label: s.label } },
          { type: "text", text: " " },
        ])
        .run();
    },
    render: () => {
      let component: ReactRenderer<SlashMenuListHandle> | null = null;
      let popup: HTMLDivElement | null = null;

      const place = (clientRect: SuggestionProps<MentionSource, SlashAction>["clientRect"]) => {
        if (!popup || !clientRect) return;
        const rect = clientRect();
        if (!rect) return;
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.bottom + 6}px`;
      };

      return {
        onStart: (props: SuggestionProps<MentionSource, SlashAction>) => {
          component = new ReactRenderer(SlashMenuList, {
            props: { items: props.items, command: props.command },
            editor: props.editor,
          });
          popup = document.createElement("div");
          popup.style.position = "fixed";
          popup.style.zIndex = "50";
          popup.appendChild(component.element);
          document.body.appendChild(popup);
          place(props.clientRect);
        },
        onUpdate: (props: SuggestionProps<MentionSource, SlashAction>) => {
          component?.updateProps({ items: props.items, command: props.command });
          place(props.clientRect);
        },
        onKeyDown: (props: SuggestionKeyDownProps) => {
          if (props.event.key === "Escape") return false; // let the plugin close the menu
          return component?.ref?.onKeyDown(props.event) ?? false;
        },
        onExit: () => {
          popup?.remove();
          component?.destroy();
          popup = null;
          component = null;
        },
      };
    },
  };
}
