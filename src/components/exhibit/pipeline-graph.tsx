"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { motion, useReducedMotion } from "motion/react";
import "@xyflow/react/dist/style.css";
import type { PipelineState } from "@/app/exhibit/exhibit-stream-context";
import type { DashboardEvent } from "@/lib/dashboard-events.types";
import { NODE_DEFS, EDGE_DEFS, NODE_OF } from "@/lib/agent/pipeline-topology";
import { stepConfidence, stepReason } from "./pipeline-utils";
import { cn } from "@/lib/utils";

/**
 * The triage engine, drawn as it actually runs (see `triage.service.ts`): a
 * branching DAG, not a linear list. Three classifiers fan out **in parallel**,
 * the module scopes the KB search, retrieval branches into two reply-builders
 * that can call tools, and everything converges on the auto-reply gate before a
 * reply goes out. Nodes light up and edges flow as a ticket traverses the graph.
 */

type NodeStatus = "idle" | "active" | "done" | "blocked" | "draft" | "sent";

interface TriageNodeData {
  icon: string;
  label: string;
  status: NodeStatus;
  detail: string | null;
  /** The AI's reasoning for this step — rendered as the glass-box "why". */
  reason: string | null;
  /** 0–1 confidence for steps that score themselves; drives the meter. */
  confidence: number | null;
  optional: boolean;
  reduceMotion: boolean;
  [key: string]: unknown;
}

/**
 * Topology (`NODE_DEFS`, `EDGE_DEFS`) and the event→node map (`NODE_OF`) now
 * live in `@/lib/agent/pipeline-topology` so the exhibit monitor and the Agent
 * Canvas editor share one definition.
 */

/** Per-status palette — kept in the DESIGN.md status spectrum. */
const STATUS_STROKE: Record<NodeStatus, string> = {
  idle: "#e4e4e7", // zinc-200
  active: "#f59e0b", // amber-500
  done: "#34d399", // emerald-400
  sent: "#10b981", // emerald-500
  draft: "#f59e0b", // amber-500
  blocked: "#ef4444", // red-500
};

/** One short word naming the node's state — so meaning never rides on color alone. */
const STATUS_WORD: Record<NodeStatus, string> = {
  idle: "menunggu",
  active: "berjalan",
  done: "selesai",
  sent: "terkirim",
  draft: "draf",
  blocked: "ditahan",
};

/** Hidden handle styling shared by all nodes (edges still attach to it). */
const HANDLE_CLASS = "!h-1.5 !w-1.5 !border-0 !bg-transparent !opacity-0";

/**
 * Types a string out character-by-character — the "thinking out loud" beat for
 * the node the engine is working on right now. Keyed by `text`, so a new reason
 * restarts the reveal; honours reduced-motion by showing the full text at once.
 */
function Typewriter({ text, reduceMotion }: { text: string; reduceMotion: boolean }) {
  // Mounted fresh per reason (keyed at the call site), so initial state already
  // reflects the right starting point — no synchronous setState in the effect.
  const [count, setCount] = useState(reduceMotion ? text.length : 0);
  useEffect(() => {
    if (reduceMotion) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= text.length) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
  }, [text, reduceMotion]);
  return (
    <>
      {text.slice(0, count)}
      {count < text.length && (
        <span className="ml-0.5 inline-block h-[1em] w-[2px] -translate-y-px animate-pulse bg-current align-middle" />
      )}
    </>
  );
}

/** Confidence color tracks the node's status so the meter reads at a glance. */
const CONFIDENCE_FILL: Partial<Record<NodeStatus, string>> = {
  active: "bg-amber-400",
  done: "bg-emerald-400",
  sent: "bg-emerald-500",
  draft: "bg-amber-400",
};

/** A thin meter showing how sure the AI was — the visual half of the glass box. */
function ConfidenceMeter({ value, status }: { value: number; status: NodeStatus }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-100">
        <motion.div
          className={cn("h-full rounded-full", CONFIDENCE_FILL[status] ?? "bg-zinc-300")}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      <span className="font-mono text-[9px] font-semibold tabular-nums text-zinc-400">
        {pct}%
      </span>
    </div>
  );
}

function TriageNode({ data }: NodeProps) {
  const d = data as TriageNodeData;
  const active = d.status === "active";
  const idle = d.status === "idle";
  const blocked = d.status === "blocked";
  const stroke = STATUS_STROKE[d.status];

  // Idle nodes aren't the story. Render them small and quiet so the active and
  // completed path carries the eye (per "shrink what isn't the key visual").
  if (idle) {
    return (
      <div
        className={cn(
          "flex w-[150px] items-center gap-2 rounded-lg border bg-white/60 px-2.5 py-1.5",
          d.optional
            ? "border-dashed border-zinc-200 opacity-45"
            : "border-zinc-200 opacity-70",
        )}
      >
        <Handle type="target" position={Position.Left} isConnectable={false} className={HANDLE_CLASS} />
        <span className="text-sm opacity-60 grayscale">{d.icon}</span>
        <p className="truncate text-xs font-medium text-zinc-500">{d.label}</p>
        <Handle type="source" position={Position.Right} isConnectable={false} className={HANDLE_CLASS} />
      </div>
    );
  }

  return (
    <motion.div
      initial={false}
      animate={
        active && !d.reduceMotion
          ? {
              scale: 1.05,
              boxShadow: [
                `0 0 0 0 ${stroke}00`,
                `0 0 0 10px ${stroke}26`,
                `0 0 0 0 ${stroke}00`,
              ],
            }
          : { scale: active ? 1.05 : 1, boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
      }
      transition={
        active
          ? { boxShadow: { duration: 1.7, repeat: Infinity, ease: "easeInOut" }, scale: { duration: 0.3 } }
          : { duration: 0.3 }
      }
      className={cn(
        "relative w-[160px] rounded-xl border bg-white px-3 py-2.5 shadow-sm transition-colors",
        active && "z-10 border-amber-400 ring-2 ring-amber-300",
        d.status === "done" && "border-emerald-200",
        d.status === "sent" && "border-emerald-300 ring-1 ring-emerald-200",
        d.status === "draft" && "border-amber-300 ring-1 ring-amber-200",
        blocked && "border-red-300 ring-1 ring-red-200",
      )}
    >
      {/* Unmistakable "currently running" badge. */}
      {active && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white shadow">
            {!d.reduceMotion && (
              <motion.span
                className="size-1.5 rounded-full bg-white"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.1, repeat: Infinity }}
              />
            )}
            Diproses
          </span>
        </div>
      )}
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className={HANDLE_CLASS}
      />
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg text-base",
            active
              ? "bg-amber-100"
              : d.status === "done" || d.status === "sent"
                ? "bg-emerald-50"
                : blocked
                  ? "bg-red-50"
                  : d.status === "draft"
                    ? "bg-amber-50"
                    : "bg-zinc-100",
          )}
        >
          {d.icon}
        </span>
        <p className="min-w-0 flex-1 text-[13px] font-semibold leading-tight text-zinc-900">
          {d.label}
        </p>
      </div>

      {/* Live status line — word + (optional) detail. Never color-only. */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-wide",
            active && "text-amber-600",
            (d.status === "done" || d.status === "sent") && "text-emerald-600",
            blocked && "text-red-600",
            d.status === "draft" && "text-amber-600",
          )}
        >
          {active && !d.reduceMotion && (
            <motion.span
              className="size-1.5 rounded-full bg-amber-500"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.1, repeat: Infinity }}
            />
          )}
          {STATUS_WORD[d.status]}
        </span>
      </div>
      {d.detail && (
        <p className="mt-0.5 truncate text-[11px] font-medium leading-snug text-zinc-600" title={d.detail}>
          {d.detail}
        </p>
      )}

      {/* The glass box: how sure it was, and — typed out live while it thinks —
          exactly why. A blocked gate tells its story in red. */}
      {d.confidence != null && <ConfidenceMeter value={d.confidence} status={d.status} />}
      {d.reason && (
        <p
          className={cn(
            "mt-1 line-clamp-2 text-[10px] italic leading-snug",
            blocked ? "font-medium text-red-600 not-italic" : "text-zinc-500",
          )}
          title={d.reason}
        >
          {active ? (
            <Typewriter key={d.reason} text={d.reason} reduceMotion={d.reduceMotion} />
          ) : (
            d.reason
          )}
        </p>
      )}

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className={HANDLE_CLASS}
      />
    </motion.div>
  );
}

/** The dashed frame that visually groups the three concurrent classifiers. */
function FrameNode({ data }: NodeProps) {
  const d = data as { label: string; w: number; h: number };
  return (
    <div
      style={{ width: d.w, height: d.h }}
      className="pointer-events-none relative rounded-2xl border border-dashed border-violet-200 bg-violet-50/30"
    >
      <span className="absolute -top-2.5 left-3 rounded-full border border-violet-200 bg-white px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-violet-600">
        ⫶⫶ Berpikir paralel
      </span>
    </div>
  );
}

const NODE_TYPES = { triage: TriageNode, frame: FrameNode };

/** Resolve every node's live status from the focused ticket's event stream. */
function deriveStatuses(
  pipeline: PipelineState,
): Record<
  string,
  { status: NodeStatus; detail: string | null; reason: string | null; confidence: number | null }
> {
  // Triage publishes events fire-and-forget, so they can arrive out of array
  // order (e.g. `kb.searched` landing AFTER `reply.sent`). Reason purely by `ts`
  // so the graph never freezes mid-pipeline after the answer already went out.
  const steps = [...pipeline.steps]
    .filter((s) => NODE_OF[s.type])
    .sort((a, b) => a.ts - b.ts);

  let replyTs = -Infinity;
  for (const s of steps) if (s.type === "reply.sent" && s.ts > replyTs) replyTs = s.ts;

  // Active = the furthest non-terminal step newer than the last reply. If a reply
  // exists with nothing after it → done (no active node). If no reply yet → the
  // latest step. A follow-up re-run produces newer events and re-lights.
  let activeNode: string | undefined;
  const postReply = steps.filter((s) => s.ts > replyTs && s.type !== "reply.sent");
  if (postReply.length > 0) {
    activeNode = NODE_OF[postReply[postReply.length - 1].type];
  } else if (replyTs === -Infinity) {
    const latest = steps[steps.length - 1];
    activeNode = latest ? NODE_OF[latest.type] : "intake";
  }

  const lastFor = (nodeId: string): DashboardEvent | null => {
    let found: DashboardEvent | null = null;
    for (const s of steps) if (NODE_OF[s.type] === nodeId) found = s;
    return found;
  };

  const out: Record<
    string,
    { status: NodeStatus; detail: string | null; reason: string | null; confidence: number | null }
  > = {};
  for (const def of NODE_DEFS) {
    const ev = lastFor(def.id);
    let status: NodeStatus;
    if (def.id === activeNode) {
      status = "active";
    } else if (!ev && def.id === "intake" && steps.length > 0) {
      // Intake is the universal entry point: if the pipeline has *any* step,
      // the message was received — even when the originating `ticket.new` event
      // didn't reach this client (e.g. the wall joined the stream mid-ticket).
      status = "done";
    } else if (!ev) {
      status = "idle";
    } else if (def.id === "guard" && ev.type === "guard.offtopic" && !ev.onTopic) {
      status = "blocked";
    } else if (def.id === "gate" && ev.type === "gate.decision" && !ev.allowed) {
      status = "blocked";
    } else if (def.id === "reply" && ev.type === "reply.sent") {
      status = ev.mode === "draft" ? "draft" : "sent";
    } else {
      status = "done";
    }
    out[def.id] = {
      status,
      detail: ev?.label ?? null,
      reason: ev ? stepReason(ev) : null,
      confidence: ev ? stepConfidence(ev) : null,
    };
  }
  return out;
}

export function TriageGraph({
  pipeline,
  compact = false,
}: {
  pipeline: PipelineState;
  /** Stacked/small layout — tighter fit padding, lighter chrome. */
  compact?: boolean;
}) {
  const reduceMotion = useReducedMotion() ?? false;

  const { nodes, edges, statuses } = useMemo(() => {
    const statuses = deriveStatuses(pipeline);

    const nodes: Node[] = [
      {
        id: "frame",
        type: "frame",
        position: { x: 276, y: 82 },
        data: { label: "Berpikir paralel", w: 210, h: 410 },
        draggable: false,
        selectable: false,
        zIndex: 0,
      },
      ...NODE_DEFS.map((def): Node => ({
        id: def.id,
        type: "triage",
        position: { x: def.x, y: def.y },
        data: {
          icon: def.icon,
          label: def.label,
          optional: def.optional ?? false,
          status: statuses[def.id].status,
          detail: statuses[def.id].detail,
          reason: statuses[def.id].reason,
          confidence: statuses[def.id].confidence,
          reduceMotion,
        } satisfies TriageNodeData,
        draggable: false,
        selectable: false,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        zIndex: 1,
      })),
    ];

    const edges: Edge[] = EDGE_DEFS.map(({ from, to, optional }) => {
      const target = statuses[to].status;
      const traversed = target !== "idle";
      const isActive = target === "active";
      const stroke = STATUS_STROKE[target];
      return {
        id: `${from}-${to}`,
        source: from,
        target: to,
        type: "smoothstep",
        animated: isActive && !reduceMotion,
        style: {
          stroke,
          strokeWidth: isActive ? 2.4 : traversed ? 2 : 1.4,
          opacity: traversed ? 1 : optional ? 0.35 : 0.6,
          strokeDasharray: !traversed && optional ? "4 4" : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: stroke,
          width: 16,
          height: 16,
        },
      };
    });

    return { nodes, edges, statuses };
  }, [pipeline, reduceMotion]);

  // Non-visual fallback: the live path as an ordered list for screen readers.
  const activeStage =
    NODE_DEFS.find((d) => statuses[d.id].status === "active")?.label ?? null;

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: compact ? 0.06 : 0.04 }}
        minZoom={0.2}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        // Navigate the canvas itself: drag to pan, scroll/pinch to zoom. Nodes
        // stay locked (nodesDraggable=false) so only the viewport moves.
        panOnDrag
        panOnScroll={false}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
        preventScrolling
        proOptions={{ hideAttribution: true }}
        className="!bg-transparent"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1}
          color={compact ? "#f4f4f5" : "#e4e4e7"}
        />
        <Controls
          showInteractive={false}
          className="!shadow-md"
          position="bottom-right"
        />
      </ReactFlow>

      <p className="sr-only" aria-live="polite">
        {pipeline.done
          ? "Triage selesai."
          : activeStage
            ? `Tahap saat ini: ${activeStage}.`
            : "Menunggu."}
      </p>
      <ol className="sr-only">
        {pipeline.steps.map((s) => (
          <li key={s.id}>{s.label}</li>
        ))}
      </ol>
    </div>
  );
}
