"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  useExhibitStream,
  type PipelineState,
} from "@/app/exhibit/exhibit-stream-context";
import type { DashboardEvent } from "@/lib/dashboard-events.types";
import { eventMeta, formatDuration } from "./event-meta";
import { cn } from "@/lib/utils";

/** Pull the human-facing payoff out of a finished pipeline's event stream. */
export function pipelineSummary(pipeline: PipelineState) {
  const reply = pipeline.steps.find((s) => s.type === "reply.sent");
  const kb = pipeline.steps.find((s) => s.type === "kb.matched");
  const firstTs = pipeline.steps[0]?.ts;
  const lastTs = reply?.ts;
  return {
    replyPreview: reply && reply.type === "reply.sent" ? reply.preview : null,
    isDraft: reply && reply.type === "reply.sent" ? reply.mode === "draft" : false,
    kbTitle: kb && kb.type === "kb.matched" ? kb.title : null,
    latencyMs: firstTs != null && lastTs != null ? Math.max(0, lastTs - firstTs) : null,
  };
}

/** A confidence bar (0–1) that animates its width as the value lands. */
function ConfidenceBar({ value, accent }: { value: number; accent: string }) {
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
      <motion.div
        className={cn("h-full rounded-full", accent)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
}

/** Pull a confidence value out of the events that carry one. */
function stepConfidence(e: DashboardEvent): number | null {
  switch (e.type) {
    case "classify.module":
    case "kb.matched":
    case "procedure.picked":
      return e.confidence;
    default:
      return null;
  }
}

function StepRow({ step }: { step: DashboardEvent }) {
  const meta = eventMeta(step.type);
  const confidence = stepConfidence(step);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="border-l-2 border-zinc-200 pl-3"
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "font-mono text-[10px] font-semibold tracking-wider",
            meta.accent,
          )}
        >
          {meta.tag}
        </span>
        <span className="text-sm text-zinc-700">{step.label}</span>
      </div>
      {confidence != null && (
        <ConfidenceBar
          value={confidence}
          accent={meta.accent.replace("text-", "bg-")}
        />
      )}
    </motion.div>
  );
}

function PipelineCard({
  pipeline,
  token,
}: {
  pipeline: PipelineState;
  token?: string;
}) {
  const inspectHref = token
    ? `/exhibit/inspect/${pipeline.ticketId}?token=${encodeURIComponent(token)}`
    : `/exhibit/inspect/${pipeline.ticketId}`;
  const summary = pipelineSummary(pipeline);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.3 } }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "rounded-xl border bg-white p-4 shadow-sm",
        pipeline.boothVisitor
          ? "border-amber-300 ring-1 ring-amber-200"
          : pipeline.done
            ? "border-emerald-200"
            : "border-zinc-200",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Link href={inspectHref} className="truncate hover:text-sky-600">
              {pipeline.requesterName ?? "Pelanggan"}
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
          <span className="shrink-0 rounded-full border border-emerald-200/70 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-700">
            SELESAI
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-sky-200/70 bg-sky-50 px-2 py-0.5 font-mono text-[10px] font-medium text-sky-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
            MENGANALISIS
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {pipeline.steps.map((step) => (
            <StepRow key={step.id} step={step} />
          ))}
        </AnimatePresence>
      </div>

      {pipeline.done && summary.replyPreview && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mt-3 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-3 shadow-sm"
        >
          <div className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
            <span className="text-amber-600">
              {summary.isDraft ? "✦ Draf untuk staf" : "✦ Jawaban AI"}
            </span>
            {summary.latencyMs != null && (
              <span className="text-amber-600/80">
                ⚡ {formatDuration(summary.latencyMs)}
              </span>
            )}
          </div>
          <p className="line-clamp-3 text-sm leading-relaxed text-zinc-800">
            {summary.replyPreview}
          </p>
          {summary.kbTitle && (
            <p className="mt-2 font-mono text-[10px] text-amber-700/70">
              📖 Sumber: {summary.kbTitle}
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * The center stage: one card per active ticket, each showing its reasoning
 * unfolding step by step as events arrive. Cards animate in on first activity
 * and out when evicted.
 */
export function PipelineTheater() {
  const { pipelines, token } = useExhibitStream();

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex shrink-0 items-baseline justify-between gap-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-zinc-500">
          Agent Pipeline
        </h2>
        <p className="font-mono text-[10px] text-zinc-600">
          Membaca → Memahami → Mencari → Menjawab
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        {pipelines.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Menunggu percakapan…</p>
          </div>
        ) : (
          <div className="grid gap-3">
            <AnimatePresence initial={false}>
              {pipelines.map((p) => (
                <PipelineCard key={p.ticketId} pipeline={p} token={token} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
