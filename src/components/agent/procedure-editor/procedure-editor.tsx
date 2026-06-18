"use client";

import { useEffect, useMemo, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Mention } from "./mention-node";
import { makeSlashSuggestion } from "./slash-menu";
import { emptyProcedureContent, type ProcedureContent } from "@/lib/agent/procedure-content";
import type { MentionSource } from "@/services/agent-mention-sources.service";

export function ProcedureEditor({
  value,
  onChange,
  sources,
  onCreateTool,
  onCreateKb,
}: {
  value: ProcedureContent | null;
  onChange: (content: ProcedureContent) => void;
  sources: MentionSource[];
  onCreateTool?: () => void;
  onCreateKb?: () => void;
}) {
  // Read sources/callbacks through a ref so the suggestion always sees the
  // latest without re-creating the editor (which would lose cursor state).
  const liveRef = useRef({ sources, onCreateTool, onCreateKb });
  useEffect(() => {
    liveRef.current = { sources, onCreateTool, onCreateKb };
  }, [sources, onCreateTool, onCreateKb]);

  const mention = useMemo(
    () =>
      Mention.configure({
        // These closures defer all ref access until the `/` menu opens (an event,
        // never render), so reading liveRef.current here is safe by construction.
        // eslint-disable-next-line react-hooks/refs
        suggestion: makeSlashSuggestion({
          getSources: () => liveRef.current.sources,
          onCreateTool: () => liveRef.current.onCreateTool?.(),
          onCreateKb: () => liveRef.current.onCreateKb?.(),
        }),
      }),
    [],
  );

  const editor = useEditor({
    extensions: [StarterKit, mention],
    content: value ?? emptyProcedureContent(),
    immediatelyRender: false, // required under Next.js SSR to avoid hydration mismatch
    onUpdate: ({ editor }) => onChange(editor.getJSON() as ProcedureContent),
    editorProps: {
      attributes: {
        class:
          "min-h-[180px] rounded-md border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring [&_ol]:ml-5 [&_ol]:list-decimal [&_ul]:ml-5 [&_ul]:list-disc [&_li]:my-0.5",
      },
    },
  });

  return (
    <div>
      <EditorContent editor={editor} />
      <p className="mt-1.5 text-xs text-muted-foreground">
        Ketik <kbd className="rounded border px-1">/</kbd> untuk menyisipkan Knowledge, Integrasi, Modul, atau Waktu.
      </p>
    </div>
  );
}
