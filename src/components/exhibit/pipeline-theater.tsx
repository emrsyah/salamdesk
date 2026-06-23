"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  useExhibitStream,
  type PipelineState,
} from "@/app/exhibit/exhibit-stream-context";
import type { DashboardEvent } from "@/lib/dashboard-events.types";
import { eventMeta } from "./event-meta";
import { cn } from "@/lib/utils";

/** A confidence bar (0–1) that animates its width as the value lands. */
function ConfidenceBar({ value, accent }: { value: number; accent: string }) {
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
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
      className="border-l-2 border-white/10 pl-3"
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
        <span className="text-sm text-zinc-300">{step.label}</span>
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
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.3 } }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "rounded-xl border bg-white/[0.03] p-4",
        pipeline.boothVisitor
          ? "border-fuchsia-500/40 ring-1 ring-fuchsia-500/20"
          : pipeline.done
            ? "border-emerald-500/30"
            : "border-white/10",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Link href={inspectHref} className="truncate hover:text-sky-400">
              {pipeline.requesterName ?? "Pelanggan"}
            </Link>
            {pipeline.boothVisitor && (
              <span className="shrink-0 rounded-full bg-fuchsia-500/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-fuchsia-300">
                👋 BOOTH
              </span>
            )}
          </p>
          <p className="truncate text-xs text-zinc-500">{pipeline.preview}</p>
        </div>
        {pipeline.done ? (
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
            SELESAI
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-sky-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-sky-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
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
      <h2 className="mb-3 shrink-0 font-mono text-xs uppercase tracking-widest text-zinc-500">
        Agent Pipeline
      </h2>
      <div className="flex-1 overflow-hidden">
        {pipelines.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <p className="max-w-xs text-sm text-zinc-600">
              Menunggu percakapan… kirim pesan WhatsApp untuk melihat agen
              bekerja secara langsung.
            </p>
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
