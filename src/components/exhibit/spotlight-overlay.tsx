"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  useExhibitStream,
  type PipelineState,
} from "@/app/exhibit/exhibit-stream-context";
import { formatDuration, stepMeta } from "./event-meta";
import { pipelineSummary } from "./pipeline-utils";

/** How long the celebration lingers after the reply lands, before fading out. */
const SPOTLIGHT_HOLD_MS = 9_000;

/** A short burst of falling confetti — hand-rolled to avoid a new dependency. */
function Confetti() {
  const colors = ["#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];
  // Deterministic spread (no Math.random) so SSR/animation stay stable.
  const pieces = Array.from({ length: 28 }, (_, i) => ({
    left: (i * 37) % 100,
    delay: (i % 7) * 0.12,
    color: colors[i % colors.length],
    rotate: (i % 2 === 0 ? 1 : -1) * (120 + (i % 5) * 40),
  }));
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-0 h-2.5 w-1.5 rounded-sm"
          style={{ left: `${p.left}%`, background: p.color }}
          initial={{ y: -40, opacity: 0, rotate: 0 }}
          animate={{ y: "105vh", opacity: [0, 1, 1, 0], rotate: p.rotate }}
          transition={{ duration: 2.6, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

/** One stage in the live journey tracker. */
function Stage({
  icon,
  title,
  detail,
  active,
}: {
  icon: string;
  title: string;
  detail: string;
  active: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-4"
    >
      <span
        className={
          active
            ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-2xl ring-2 ring-amber-300"
            : "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-2xl"
        }
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold text-zinc-900">{title}</p>
        <p className="truncate text-sm text-zinc-500">{detail}</p>
      </div>
      {active && (
        <span className="ml-auto h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-amber-500" />
      )}
    </motion.div>
  );
}

function SpotlightCard({ pipeline }: { pipeline: PipelineState }) {
  const summary = pipelineSummary(pipeline);
  const name = pipeline.requesterName?.trim() || "Pengunjung";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-white/75 p-4 backdrop-blur-md sm:p-6"
    >
      {pipeline.done && <Confetti />}
      <motion.div
        initial={{ scale: 0.92, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        className="relative my-auto max-h-full w-full max-w-2xl overflow-y-auto rounded-3xl border border-amber-200 bg-white p-5 shadow-2xl ring-1 ring-amber-100 sm:p-8"
      >
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-amber-700">
              👋 PENGUNJUNG BOOTH
            </span>
            <h2 className="mt-3 truncate text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
              Halo, {name}!
            </h2>
            <p className="mt-1 text-base text-zinc-500">
              {pipeline.done
                ? "Pesan Anda sudah dijawab — lihat hasilnya 👇"
                : "AI kami sedang membaca & menjawab pesan Anda…"}
            </p>
          </div>
          {pipeline.done && summary.latencyMs != null && (
            <div className="shrink-0 text-right">
              <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                Waktu jawab
              </p>
              <p className="text-3xl font-bold tabular-nums text-amber-600 sm:text-4xl">
                {formatDuration(summary.latencyMs)}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {pipeline.steps.map((step, i) => {
            const meta = stepMeta(step.type);
            const isLast = i === pipeline.steps.length - 1;
            return (
              <Stage
                key={step.id}
                icon={meta.icon}
                title={meta.title}
                detail={step.label}
                active={isLast && !pipeline.done}
              />
            );
          })}
        </div>

        {pipeline.done && summary.replyPreview && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-5 shadow-sm"
          >
            <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-amber-600">
              {summary.isDraft ? "✦ Draf untuk staf" : "✦ Jawaban AI"}
            </p>
            <p className="text-lg leading-relaxed text-zinc-800">
              {summary.replyPreview}
            </p>
            {summary.kbTitle && (
              <p className="mt-3 font-mono text-xs text-amber-700/70">
                📖 Berdasarkan panduan: {summary.kbTitle}
              </p>
            )}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

/**
 * Full-screen takeover that spotlights a booth visitor's journey the moment
 * they message via the QR — the "that's me on the wall!" beat. Holds a short
 * celebration after the reply lands, then fades back to the ambient wall.
 */
export function SpotlightOverlay() {
  const { pipelines } = useExhibitStream();
  // Pipelines arrive newest-first, so the first booth visitor is the freshest.
  const candidate = pipelines.find((p) => p.boothVisitor) ?? null;
  const candidateId = candidate?.ticketId ?? null;
  const candidateDone = candidate?.done ?? false;
  const [now, setNow] = useState(() => Date.now());
  // When (and for which ticket) the reply landed — drives the celebration hold.
  const [doneInfo, setDoneInfo] = useState<{ ticketId: string; at: number } | null>(null);

  useEffect(() => {
    if (!candidateId) return;
    // The interval callback is async, so recording the reply-landed moment here
    // (rather than in the effect body) avoids cascading synchronous renders.
    const id = setInterval(() => {
      setNow(Date.now());
      if (candidateDone) {
        setDoneInfo((prev) =>
          prev?.ticketId === candidateId
            ? prev
            : { ticketId: candidateId, at: Date.now() },
        );
      }
    }, 250);
    return () => clearInterval(id);
  }, [candidateId, candidateDone]);

  let visible = false;
  if (candidate) {
    if (!candidate.done) {
      visible = true;
    } else {
      const doneAt = doneInfo?.ticketId === candidate.ticketId ? doneInfo.at : null;
      visible = doneAt == null || now - doneAt < SPOTLIGHT_HOLD_MS;
    }
  }

  return (
    <AnimatePresence>
      {visible && candidate && (
        <SpotlightCard key={candidate.ticketId} pipeline={candidate} />
      )}
    </AnimatePresence>
  );
}
