"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import type { MentionKind } from "@/lib/agent/procedure-content";
import type { MentionSource } from "@/services/agent-mention-sources.service";

export type SlashAction =
  | { type: "insert"; source: MentionSource }
  | { type: "create-tool" }
  | { type: "create-kb" };

export type SlashMenuListProps = {
  items: MentionSource[];
  command: (action: SlashAction) => void;
};

export type SlashMenuListHandle = {
  onKeyDown: (event: KeyboardEvent) => boolean;
};

const GROUP_LABEL: Record<MentionKind, string> = {
  kb: "Knowledge",
  tool: "Integrations",
  module: "Module",
  time: "Time",
};
const GROUP_ORDER: MentionKind[] = ["kb", "tool", "module", "time"];

// A flat, ordered list of selectable rows: grouped sources + trailing "create" actions.
type Row =
  | { kind: "header"; label: string }
  | { kind: "item"; action: SlashAction; label: string; hint?: string };

function buildRows(items: MentionSource[]): Row[] {
  const rows: Row[] = [];
  for (const g of GROUP_ORDER) {
    const inGroup = items.filter((i) => i.kind === g);
    if (inGroup.length === 0) continue;
    rows.push({ kind: "header", label: GROUP_LABEL[g] });
    for (const source of inGroup) {
      rows.push({ kind: "item", action: { type: "insert", source }, label: source.label, hint: source.hint });
    }
  }
  rows.push({ kind: "header", label: "Buat baru" });
  rows.push({ kind: "item", action: { type: "create-tool" }, label: "+ Buat tool baru" });
  rows.push({ kind: "item", action: { type: "create-kb" }, label: "+ Buat KB baru" });
  return rows;
}

export const SlashMenuList = forwardRef<SlashMenuListHandle, SlashMenuListProps>(function SlashMenuList(
  { items, command },
  ref,
) {
  const rows = useMemo(() => buildRows(items), [items]);
  const selectableIndexes = useMemo(
    () => rows.flatMap((r, i) => (r.kind === "item" ? [i] : [])),
    [rows],
  );
  const [active, setActive] = useState(0);

  useEffect(() => setActive(0), [items]);

  const move = (delta: number) => {
    if (selectableIndexes.length === 0) return;
    setActive((cur) => (cur + delta + selectableIndexes.length) % selectableIndexes.length);
  };

  const select = (selIdx: number) => {
    const rowIdx = selectableIndexes[selIdx];
    const row = rows[rowIdx];
    if (row?.kind === "item") command(row.action);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        move(1);
        return true;
      }
      if (event.key === "ArrowUp") {
        move(-1);
        return true;
      }
      if (event.key === "Enter") {
        select(active);
        return true;
      }
      return false;
    },
  }));

  if (rows.length === 0) return null;

  let selIdx = -1;
  return (
    <div className="z-50 max-h-72 w-72 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
      {rows.map((row, i) => {
        if (row.kind === "header") {
          return (
            <div key={`h-${i}`} className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {row.label}
            </div>
          );
        }
        selIdx += 1;
        const isActive = selIdx === active;
        const thisSel = selIdx;
        return (
          <button
            key={`i-${i}`}
            type="button"
            onMouseEnter={() => setActive(thisSel)}
            onMouseDown={(e) => {
              e.preventDefault();
              select(thisSel);
            }}
            className={`flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left text-sm ${
              isActive ? "bg-accent text-accent-foreground" : ""
            }`}
          >
            <span className="font-medium">{row.label}</span>
            {row.hint ? <span className="line-clamp-1 text-xs text-muted-foreground">{row.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
});
