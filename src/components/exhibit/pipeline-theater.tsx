"use client";

import { Fragment } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  useExhibitStream,
  type PipelineState,
} from "@/app/exhibit/exhibit-stream-context";
import type { DashboardEvent } from "@/lib/dashboard-events.types";
import {
  PHASES,
  eventMeta,
  formatDuration,
  phaseIndex,
  stepMeta,
} from "./event-meta";
import { SectionHeader } from "./section-header";
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

/** Three dots that breathe in sequence — the "still thinking" tell. */
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

/**
 * The four-phase journey rail. Completed phases collapse to a check, the active
 * phase glows amber and pulses, future phases sit quiet — so a passer-by reads
 * "how far along is the agent?" in one glance.
 */
function PhaseRail({ current, done }: { current: number; done: boolean }) {
  return (
    <div className="flex items-center">
      {PHASES.map((p, i) => {
        const state = done || i < current ? "done" : i === current ? "active" : "todo";
        return (
          <Fragment key={p.key}>
            <div className="flex flex-1 flex-col items-center gap-1.5">
              <motion.span
                layout
                animate={
                  state === "active"
                    ? { scale: [1, 1.08, 1] }
                    : { scale: 1 }
                }
                transition={
                  state === "active"
                    ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.3 }
                }
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-base transition-colors",
                  state === "done" &&
                    "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
                  state === "active" &&
                    "bg-amber-100 text-amber-700 ring-2 ring-amber-300",
                  state === "todo" && "bg-zinc-100 text-zinc-400",
                )}
              >
                {state === "done" ? "✓" : p.icon}
              </motion.span>
              <span
                className={cn(
                  "font-mono text-[10px] uppercase tracking-wide",
                  state === "active"
                    ? "font-semibold text-amber-700"
                    : state === "done"
                      ? "text-emerald-700"
                      : "text-zinc-400",
                )}
              >
                {p.label}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div className="relative -mt-5 h-0.5 w-6 shrink-0 overflow-hidden rounded-full bg-zinc-200">
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full bg-emerald-300"
                  initial={false}
                  animate={{ width: done || i < current ? "100%" : "0%" }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/** One reasoning step, in human language: phase icon · title · live detail. */
function StepRow({ step, active }: { step: DashboardEvent; active: boolean }) {
  const meta = eventMeta(step.type);
  const human = stepMeta(step.type);
  const confidence = stepConfidence(step);
  const pct = confidence != null ? Math.round(Math.max(0, Math.min(1, confidence)) * 100) : null;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22 }}
      className={cn(
        "relative overflow-hidden rounded-lg px-2.5 py-1.5",
        active ? "bg-amber-50/70 ring-1 ring-amber-200/70" : "bg-transparent",
      )}
    >
      {/* Shimmer sweep on the step the agent is mid-thought on. */}
      {active && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/60 to-transparent"
          initial={{ x: "-120%" }}
          animate={{ x: "120%" }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <div className="relative flex items-center gap-2.5">
        <span className="text-base leading-none">{human.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-800">
              {human.title}
            </span>
            {active && <ThinkingDots className="text-amber-500" />}
            {pct != null && (
              <span
                className={cn(
                  "ml-auto font-mono text-[10px] font-semibold tabular-nums",
                  meta.accent,
                )}
              >
                {pct}%
              </span>
            )}
          </div>
          <p className="truncate text-xs text-zinc-500">{step.label}</p>
          {pct != null && (
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-zinc-100">
              <motion.div
                className={cn("h-full rounded-full", meta.accent.replace("text-", "bg-"))}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** Cap the visible trail so a replayed/long ticket never balloons the card. */
const MAX_VISIBLE_STEPS = 6;

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
  const lastStep = pipeline.steps[pipeline.steps.length - 1];
  const current = lastStep ? phaseIndex(lastStep.type) : 0;
  const name = pipeline.requesterName?.trim() || "Pelanggan";
  const initial = name.charAt(0).toUpperCase();

  const hidden = Math.max(0, pipeline.steps.length - MAX_VISIBLE_STEPS);
  const visible = pipeline.steps.slice(-MAX_VISIBLE_STEPS);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.3 } }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "rounded-xl border bg-white/95 p-4 shadow-sm backdrop-blur-sm",
        pipeline.boothVisitor
          ? "border-amber-300 ring-1 ring-amber-200"
          : pipeline.done
            ? "border-emerald-200"
            : "border-zinc-200",
      )}
    >
      {/* Identity row */}
      <div className="mb-3 flex items-center gap-3">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            pipeline.boothVisitor
              ? "bg-amber-100 text-amber-700"
              : "bg-zinc-100 text-zinc-600",
          )}
        >
          {initial}
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
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-700">
            ✓ SELESAI
            {summary.latencyMs != null && (
              <span className="text-emerald-600/80">
                · {formatDuration(summary.latencyMs)}
              </span>
            )}
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200/70 bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-medium text-amber-700">
            <ThinkingDots className="text-amber-500" />
            BERPIKIR
          </span>
        )}
      </div>

      {/* Journey rail */}
      <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 px-3 py-3">
        <PhaseRail current={current} done={pipeline.done} />
      </div>

      {/* Reasoning trail, in human language */}
      <div className="mt-3 flex flex-col gap-0.5">
        {hidden > 0 && (
          <p className="px-2.5 pb-1 font-mono text-[10px] text-zinc-400">
            +{hidden} langkah sebelumnya
          </p>
        )}
        <AnimatePresence initial={false}>
          {visible.map((step, i) => (
            <StepRow
              key={step.id}
              step={step}
              active={!pipeline.done && i === visible.length - 1}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* The payoff */}
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
 * unfolding as a four-phase journey (Membaca → Memahami → Mencari → Menjawab)
 * that lights up step by step as events arrive.
 */
export function PipelineTheater() {
  const { pipelines, token } = useExhibitStream();

  return (
    <div className="flex h-full flex-col">
      <SectionHeader
        label="Agent Pipeline"
        accent="bg-violet-500"
        right={
          <p className="font-mono text-[10px] text-zinc-500">
            Membaca → Memahami → Mencari → Menjawab
          </p>
        }
      />
      <div className="flex-1 overflow-y-auto">
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
