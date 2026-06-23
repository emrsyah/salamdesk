"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  useExhibitStream,
  type PipelineState,
} from "@/app/exhibit/exhibit-stream-context";
import { formatDuration } from "./event-meta";
import { pipelineSummary } from "./pipeline-utils";
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
 */
const WALL_GRAPH_COUNT = 3;

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
          <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Link href={inspectHref} className="truncate hover:text-sky-600">
              {name}
            </Link>
            {pipeline.boothVisitor && (
              <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-700">
                👋 BOOTH
              </span>
            )}
          </p>
          <p className="truncate text-xs text-zinc-500">{pipeline.preview}</p>
        </div>
        {pipeline.done ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-1 font-mono text-[10px] font-medium text-emerald-700">
            ✓ SELESAI
            {summary.latencyMs != null && (
              <span className="text-emerald-600/80">
                · {formatDuration(summary.latencyMs)}
              </span>
            )}
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200/70 bg-amber-50 px-2.5 py-1 font-mono text-[10px] font-medium text-amber-700">
            <ThinkingDots className="text-amber-500" />
            BERPIKIR
          </span>
        )}
      </div>

      {/* The engine */}
      <div className={cn("min-h-0 flex-1", solo ? "min-h-[280px]" : "min-h-[190px]")}>
        <TriageGraph pipeline={pipeline} compact={!solo} />
      </div>

      {/* The payoff — slim, one line when stacked. */}
      <AnimatePresence initial={false}>
        {pipeline.done && summary.replyPreview && (
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
  const lanes = pipelines.slice(0, WALL_GRAPH_COUNT);

  return (
    <div className="flex h-full flex-col">
      <SectionHeader
        label="Mesin Triage"
        accent="bg-violet-500"
        right={
          <p className="font-mono text-[10px] text-zinc-500">
            {lanes.length > 0
              ? `${lanes.length} tiket · alur agen langsung`
              : "Diagram langsung"}
          </p>
        }
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
