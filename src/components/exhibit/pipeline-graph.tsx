"use client";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
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
  optional: boolean;
  reduceMotion: boolean;
  [key: string]: unknown;
}

/** Static topology — positions hand-laid for a clean left-to-right read. */
const NODE_DEFS: {
  id: string;
  icon: string;
  label: string;
  x: number;
  y: number;
  optional?: boolean;
}[] = [
  { id: "intake", icon: "💬", label: "Pesan masuk", x: 0, y: 168 },
  { id: "vision", icon: "🖼️", label: "Baca gambar", x: 175, y: 20, optional: true },
  { id: "module", icon: "🎯", label: "Klasifikasi modul", x: 345, y: 92 },
  { id: "priority", icon: "🚦", label: "Nilai prioritas", x: 345, y: 184 },
  { id: "guard", icon: "🛡️", label: "Penjaga topik", x: 345, y: 276 },
  { id: "kb", icon: "🔎", label: "Cari panduan", x: 580, y: 92 },
  { id: "kbmatch", icon: "📖", label: "Susun jawaban", x: 800, y: 20, optional: true },
  { id: "procedure", icon: "🧭", label: "Jalankan prosedur", x: 800, y: 148, optional: true },
  { id: "tools", icon: "⚙️", label: "Panggil alat", x: 800, y: 276, optional: true },
  { id: "gate", icon: "🚪", label: "Gerbang auto-reply", x: 1035, y: 184 },
  { id: "reply", icon: "✍️", label: "Balasan", x: 1255, y: 184 },
];

/** Directed edges; `optional` ones render faint until actually traversed. */
const EDGE_DEFS: { from: string; to: string; optional?: boolean }[] = [
  { from: "intake", to: "vision", optional: true },
  { from: "vision", to: "module", optional: true },
  { from: "intake", to: "module" },
  { from: "intake", to: "priority" },
  { from: "intake", to: "guard" },
  { from: "module", to: "kb" },
  { from: "kb", to: "kbmatch" },
  { from: "kb", to: "procedure" },
  { from: "procedure", to: "tools", optional: true },
  { from: "kbmatch", to: "gate" },
  { from: "procedure", to: "gate" },
  { from: "tools", to: "gate", optional: true },
  { from: "priority", to: "gate" },
  { from: "guard", to: "gate" },
  { from: "gate", to: "reply" },
];

/** Which engine node an event lights up. */
const NODE_OF: Record<string, string> = {
  "ticket.new": "intake",
  "requester.firsttime": "intake",
  "vision.captioned": "vision",
  "classify.module": "module",
  "classify.priority": "priority",
  "guard.offtopic": "guard",
  "kb.searched": "kb",
  "kb.matched": "kbmatch",
  "procedure.picked": "procedure",
  "tool.invoked": "tools",
  "tool.result": "tools",
  "gate.decision": "gate",
  "reply.sent": "reply",
};

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

function TriageNode({ data }: NodeProps) {
  const d = data as TriageNodeData;
  const active = d.status === "active";
  const idle = d.status === "idle";
  const blocked = d.status === "blocked";
  const stroke = STATUS_STROKE[d.status];

  return (
    <motion.div
      initial={false}
      animate={
        active && !d.reduceMotion
          ? { boxShadow: [
              `0 0 0 0 ${stroke}00`,
              `0 0 0 6px ${stroke}22`,
              `0 0 0 0 ${stroke}00`,
            ] }
          : { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
      }
      transition={
        active
          ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.3 }
      }
      className={cn(
        "relative w-[156px] rounded-xl border bg-white px-3 py-2.5 shadow-sm transition-colors",
        active && "border-amber-300 ring-1 ring-amber-200",
        d.status === "done" && "border-emerald-200",
        d.status === "sent" && "border-emerald-300 ring-1 ring-emerald-200",
        d.status === "draft" && "border-amber-300 ring-1 ring-amber-200",
        blocked && "border-red-300 ring-1 ring-red-200",
        idle &&
          cn("border-zinc-200", d.optional ? "border-dashed opacity-55" : "opacity-80"),
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="!h-1.5 !w-1.5 !border-0 !bg-zinc-300 !opacity-0"
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
            idle && "text-zinc-400",
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
        <p className="mt-0.5 truncate text-[11px] leading-snug text-zinc-500" title={d.detail}>
          {d.detail}
        </p>
      )}

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!h-1.5 !w-1.5 !border-0 !bg-zinc-300 !opacity-0"
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
function deriveStatuses(pipeline: PipelineState): Record<string, { status: NodeStatus; detail: string | null }> {
  const steps = pipeline.steps;
  const latest = steps[steps.length - 1];
  const activeNode = pipeline.done ? null : latest ? NODE_OF[latest.type] : "intake";

  const lastFor = (nodeId: string): DashboardEvent | null => {
    for (let i = steps.length - 1; i >= 0; i--) {
      if (NODE_OF[steps[i].type] === nodeId) return steps[i];
    }
    return null;
  };

  const out: Record<string, { status: NodeStatus; detail: string | null }> = {};
  for (const def of NODE_DEFS) {
    const ev = lastFor(def.id);
    let status: NodeStatus;
    if (def.id === activeNode) {
      status = "active";
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
    out[def.id] = { status, detail: ev?.label ?? null };
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
        position: { x: 325, y: 64 },
        data: { label: "Berpikir paralel", w: 200, h: 296 },
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
        fitViewOptions={{ padding: compact ? 0.05 : 0.1 }}
        minZoom={0.2}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
        className="!bg-transparent"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1}
          color={compact ? "#f4f4f5" : "#e4e4e7"}
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
