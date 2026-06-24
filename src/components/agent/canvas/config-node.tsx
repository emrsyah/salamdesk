"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { NodeBadge } from "./node-summary";

export interface ConfigNodeData {
  icon: string;
  label: string;
  badges: NodeBadge[];
  optional: boolean;
  /** Optional node whose enabling flag is off — render faint. */
  dimmed: boolean;
  /** Has a registered editor — show a clickable affordance. */
  editable: boolean;
  /** This node's drawer is currently open — show a selection ring. */
  selected: boolean;
  [key: string]: unknown;
}

/** Hidden handles — edges still attach, but the dots stay invisible. */
const HANDLE_CLASS = "!h-1.5 !w-1.5 !border-0 !bg-transparent !opacity-0";

const TONE_CLASS: Record<NodeBadge["tone"], string> = {
  normal: "bg-muted text-muted-foreground",
  muted: "bg-muted/60 text-muted-foreground/70",
  bypassed: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

/**
 * A stage node on the Agent Canvas. Phase 1: static, read-only — shows the
 * stage's name + current-value badges derived from the live config. Selection
 * and the edit drawer arrive in Phase 2.
 */
export function ConfigNode({ data }: NodeProps) {
  const d = data as ConfigNodeData;
  return (
    <div
      role={d.editable ? "button" : undefined}
      aria-label={d.editable ? `Atur ${d.label}` : undefined}
      className={cn(
        "w-[180px] rounded-xl border bg-background px-3 py-2.5 shadow-sm transition-all",
        d.optional ? "border-dashed" : "border-border",
        d.dimmed && "opacity-45",
        d.editable
          ? "cursor-pointer hover:border-primary/50 hover:shadow-md"
          : "cursor-default",
        d.selected && "border-primary ring-2 ring-primary/30",
      )}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} className={HANDLE_CLASS} />
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-base">
          {d.icon}
        </span>
        <p className="min-w-0 flex-1 text-[13px] font-semibold leading-tight">{d.label}</p>
      </div>
      {d.badges.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {d.badges.map((b, i) => (
            <span
              key={i}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                TONE_CLASS[b.tone],
              )}
            >
              {b.text}
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} isConnectable={false} className={HANDLE_CLASS} />
    </div>
  );
}
