"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  useExhibitStream,
  type PipelineState,
} from "@/app/exhibit/exhibit-stream-context";
import { formatDuration } from "./event-meta";
import { pipelineSummary, ticketSignals } from "./pipeline-utils";
import { SectionHeader } from "./section-header";
import { TriageGraph } from "./pipeline-graph";
import { cn } from "@/lib/utils";

// Re-exported for callers (e.g. the spotlight overlay) that historically
// imported it from here.
export { pipelineSummary } from "./pipeline-utils";

/**
 * How many of the latest tickets to show as simultaneous engine diagrams,
 * newest first. Tune this to taste:
 *   • 1  → a single large graph (focus mode)
 *   • 3  → three stacked lanes (default)
 * Capped by how many pipelines are kept live at once — raise
 * `PIPELINE_CAPACITY` in exhibit-stream-context.tsx to go above that.
 *
 * This is just the *default* — operators change it live via the on-screen
 * control in the section header.
 */
const WALL_GRAPH_COUNT = 3;
/** Choices offered by the on-screen count control. */
const COUNT_OPTIONS = [1, 2, 3, 4];

/** Segmented control: how many concurrent tickets to render at once. */
function CountControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
        Tampil
      </span>
      <div
        role="radiogroup"
        aria-label="Jumlah tiket ditampilkan"
        className="flex items-center gap-0.5 rounded-full border border-zinc-200 bg-white/80 p-0.5 backdrop-blur-sm"
      >
        {COUNT_OPTIONS.map((n) => {
          const on = n === value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${n} tiket`}
              onClick={() => onChange(n)}
              className={cn(
                "flex size-6 items-center justify-center rounded-full font-mono text-xs font-semibold tabular-nums transition-colors",
                on
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-zinc-500 hover:bg-zinc-100",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Breathing dots — the "still thinking" tell. */
function ThinkingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1 w-1 rounded-full bg-current"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </span>
  );
}

const PRIORITY_CHIP: Record<string, { label: string; cls: string }> = {
  low: { label: "Rendah", cls: "border-blue-200/70 bg-blue-50 text-blue-700" },
  medium: { label: "Sedang", cls: "border-orange-200/70 bg-orange-50 text-orange-700" },
  critical: { label: "Kritis", cls: "border-red-200/70 bg-red-50 text-red-700" },
};

/** The ticket's live module + priority — "where they are right now". */
function StatusChips({
  moduleName,
  priority,
}: {
  moduleName: string | null;
  priority: "low" | "medium" | "critical" | null;
}) {
  const pr = priority ? PRIORITY_CHIP[priority] : null;
  if (!moduleName && !pr) return null;
  return (
    <span className="flex items-center gap-1.5">
      {moduleName && (
        <span className="inline-flex items-center gap-1 rounded-full border border-violet-200/70 bg-violet-50 px-2 py-0.5 font-mono text-[10px] font-medium text-violet-700">
          <span className="size-1.5 rounded-full bg-violet-500" />
          {moduleName}
        </span>
      )}
      {pr && (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium",
            pr.cls,
          )}
        >
          {pr.label}
        </span>
      )}
    </span>
  );
}

/** One ticket's live engine: caption · the graph · the answer payoff. */
function PipelineLane({
  pipeline,
  token,
  solo,
}: {
  pipeline: PipelineState;
  token?: string;
  /** When the only lane, the graph gets a touch more breathing room. */
  solo: boolean;
}) {
  const summary = pipelineSummary(pipeline);
  const signals = ticketSignals(pipeline);
  const name = pipeline.requesterName?.trim() || "Pelanggan";
  const inspectHref = token
    ? `/exhibit/inspect/${pipeline.ticketId}?token=${encodeURIComponent(token)}`
    : `/exhibit/inspect/${pipeline.ticketId}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white/70 backdrop-blur-sm">
      {/* Caption */}
      <div className="flex shrink-0 items-center gap-3 border-b border-zinc-100 px-4 py-2.5">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            pipeline.boothVisitor
              ? "bg-amber-100 text-amber-700"
              : "bg-zinc-100 text-zinc-600",
          )}
        >
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-zinc-900">
            <Link href={inspectHref} className="truncate hover:text-sky-600">
              {name}
            </Link>
            {pipeline.boothVisitor && (
              <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-700">
                👋 BOOTH
              </span>
            )}
            <StatusChips moduleName={signals.moduleName} priority={signals.priority} />
          </p>
          <p className="truncate text-xs text-zinc-500">{pipeline.preview}</p>
        </div>
        {signals.running ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200/70 bg-amber-50 px-2.5 py-1 font-mono text-[10px] font-medium text-amber-700">
            <ThinkingDots className="text-amber-500" />
            BERPIKIR
          </span>
        ) : signals.replied ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-1 font-mono text-[10px] font-medium text-emerald-700">
            ✓ SELESAI
            {summary.latencyMs != null && (
              <span className="text-emerald-600/80">
                · {formatDuration(summary.latencyMs)}
              </span>
            )}
          </span>
        ) : null}
      </div>

      {/* The engine */}
      <div className={cn("min-h-0 flex-1", solo ? "min-h-[280px]" : "min-h-[190px]")}>
        <TriageGraph pipeline={pipeline} compact={!solo} />
      </div>

      {/* The payoff — slim, one line when stacked. */}
      <AnimatePresence initial={false}>
        {signals.replied && summary.replyPreview && (
          <motion.div
            key="answer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="shrink-0 border-t border-amber-100 bg-gradient-to-br from-amber-50 to-yellow-50 px-4 py-2"
          >
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-amber-600">
              <span>{summary.isDraft ? "✦ Draf" : "✦ Jawaban AI"}</span>
              {summary.kbTitle && (
                <span className="truncate text-amber-700/70">📖 {summary.kbTitle}</span>
              )}
            </div>
            <p
              className={cn(
                "text-sm leading-relaxed text-zinc-800",
                solo ? "line-clamp-2" : "line-clamp-1",
              )}
            >
              {summary.replyPreview}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Center stage: the live triage engine as node graphs. Shows the newest
 * {@link WALL_GRAPH_COUNT} tickets at once, each running through the actual
 * branching pipeline — parallel classifiers, the search-and-answer branch, the
 * gate — lighting up as events arrive.
 */
export function PipelineTheater() {
  const { pipelines, token } = useExhibitStream();
  const [count, setCount] = useState(WALL_GRAPH_COUNT);
  const lanes = pipelines.slice(0, count);

  return (
    <div className="flex h-full flex-col">
      <SectionHeader
        label="Mesin Triage"
        accent="bg-violet-500"
        right={<CountControl value={count} onChange={setCount} />}
      />

      {lanes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Menunggu percakapan…</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          <AnimatePresence initial={false}>
            {lanes.map((p) => (
              <motion.div
                key={p.ticketId}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.25 } }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <PipelineLane
                  pipeline={p}
                  token={token}
                  solo={lanes.length === 1}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
