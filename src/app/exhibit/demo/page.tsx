"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import type { PipelineState } from "@/app/exhibit/exhibit-stream-context";
import type { DashboardEvent } from "@/lib/dashboard-events.types";
import { TriageGraph } from "@/components/exhibit/pipeline-graph";
import { formatDuration, stepMeta } from "@/components/exhibit/event-meta";
import { pipelineSummary } from "@/components/exhibit/pipeline-utils";
import { cn } from "@/lib/utils";

/** How long each step holds while auto-playing. */
const AUTOPLAY_MS = 1900;

// Distributive omit so each union member keeps its own discriminated fields
// (a plain Omit<Union, K> collapses to only the members' shared keys).
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type DemoEvent = DistributiveOmit<DashboardEvent, "id" | "ts" | "ticketId">;

interface ScriptStep {
  /** Everything except id/ts/ticketId, which we stamp below. */
  event: DemoEvent;
  /** Milliseconds this step takes (drives the realistic "speed" readout). */
  ms: number;
  /** Plain-language teaching note shown beside the graph. */
  explain: string;
}

const TICKET_ID = "demo";

// A realistic, fully on-topic flow — printer SEP error — chosen so the graph
// lights its main path (intake → parallel classifiers → KB → gate → reply).
const SCRIPT: ScriptStep[] = [
  {
    ms: 0,
    event: {
      type: "ticket.new",
      label: "Pesan masuk",
      requesterName: "Pengunjung Demo",
      preview: "Printer SEP error saat cetak, muncul kode E-205",
      channel: "whatsapp",
      boothVisitor: true,
    },
    explain:
      "Pesan WhatsApp masuk dan otomatis menjadi tiket. Agen AI langsung mulai membacanya — tidak ada antrean, tidak ada operator yang harus menyalin manual.",
  },
  {
    ms: 700,
    event: {
      type: "classify.module",
      label: "Modul: Billing (91%)",
      moduleId: "demo",
      moduleName: "Billing",
      confidence: 0.91,
      reason: "Menyebut SEP & cetak — terkait modul billing.",
    },
    explain:
      "AI mengklasifikasikan pesan ke modul SIMRS yang tepat — di sini Billing — supaya pencarian solusi terfokus pada area yang benar. Tiga klasifikasi ini berjalan bersamaan (paralel).",
  },
  {
    ms: 500,
    event: {
      type: "classify.priority",
      label: "Prioritas: critical",
      priority: "critical",
      reason: "Berdampak ke pelayanan pasien (cetak SEP terhenti).",
    },
    explain:
      "Bersamaan, AI menilai urgensi. Cetak SEP yang terhenti menghambat pelayanan pasien, jadi tiket ini ditandai kritis agar ditangani lebih dahulu.",
  },
  {
    ms: 500,
    event: {
      type: "guard.offtopic",
      label: "Dalam topik SIMRS",
      onTopic: true,
      reason: "Pertanyaan teknis SIMRS yang valid.",
    },
    explain:
      "Penjaga topik memastikan pesan benar-benar soal SIMRS sebelum boleh dijawab otomatis. Pertanyaan di luar layanan akan ditahan sebagai draf untuk staf.",
  },
  {
    ms: 600,
    event: {
      type: "kb.searched",
      label: "Cari KB: 3 kandidat",
      query: "printer sep error e-205",
      chunksScanned: 3,
      matchCount: 3,
    },
    explain:
      "AI menelusuri basis pengetahuan (panduan internal) untuk menemukan prosedur yang relevan dengan keluhan ini.",
  },
  {
    ms: 600,
    event: {
      type: "kb.matched",
      label: "KB cocok: Reset Printer SEP (88%)",
      documentId: "demo",
      title: "Reset Printer SEP",
      score: 0.88,
      confidence: 0.88,
    },
    explain:
      "Ditemukan panduan yang cocok. AI menyusun jawaban berlandaskan panduan ini — bukan mengarang — sehingga balasannya bisa dipercaya.",
  },
  {
    ms: 600,
    event: {
      type: "gate.decision",
      label: "Lolos gate auto-reply",
      allowed: true,
      blockedReason: null,
      bypasses: [],
    },
    explain:
      "Gerbang keamanan memeriksa keyakinan jawaban, prioritas, dan kebijakan. Hanya jawaban yang lolos semua pemeriksaan yang boleh terkirim otomatis.",
  },
  {
    ms: 400,
    event: {
      type: "reply.sent",
      label: "Balasan AI terkirim",
      mode: "immediate",
      isAiFirst: false,
      preview:
        "Untuk error E-205, mohon matikan printer SEP selama 10 detik lalu nyalakan kembali, kemudian ulangi cetak. Bila masih gagal, balas pesan ini ya.",
    },
    explain:
      "Balasan terkirim ke pelanggan lewat WhatsApp — semuanya dalam hitungan detik, tanpa menunggu operator.",
  },
];

/** Build the full event list once, with monotonically increasing timestamps. */
function buildEvents(): DashboardEvent[] {
  let ts = 1000;
  return SCRIPT.map((s, i) => {
    ts += s.ms;
    return { id: `d${i}`, ts, ticketId: TICKET_ID, ...s.event } as DashboardEvent;
  });
}

export default function DemoPage() {
  const events = useMemo(buildEvents, []);
  const last = SCRIPT.length - 1;

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Auto-advance while playing; stop at the end.
  useEffect(() => {
    if (!playing) return;
    if (step >= last) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setStep((s) => Math.min(last, s + 1)), AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [playing, step, last]);

  const pipeline = useMemo<PipelineState>(() => {
    const steps = events.slice(0, step + 1);
    const head = steps[0];
    return {
      ticketId: TICKET_ID,
      requesterName:
        head?.type === "ticket.new" ? head.requesterName : "Pengunjung Demo",
      preview: head?.type === "ticket.new" ? head.preview : "",
      lastTs: steps[steps.length - 1]?.ts ?? 0,
      steps,
      done: steps[steps.length - 1]?.type === "reply.sent",
      boothVisitor: true,
    };
  }, [events, step]);

  const current = SCRIPT[step];
  const meta = stepMeta(current.event.type);
  const summary = pipelineSummary(pipeline);
  const atEnd = step >= last;

  const go = (n: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(last, n)));
  };
  const togglePlay = () => {
    if (atEnd) setStep(0);
    setPlaying((p) => !p);
  };

  return (
    <div className="flex h-screen flex-col bg-gradient-to-b from-amber-50/30 via-background to-background">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border/60 bg-background/70 px-6 py-3 backdrop-blur-md">
        <div className="min-w-0">
          <Link
            href="/exhibit"
            className="font-mono text-xs text-zinc-500 transition-colors hover:text-zinc-900"
          >
            ← Kembali ke wall
          </Link>
          <h1 className="mt-0.5 text-lg font-bold tracking-tight text-zinc-950">
            Bagaimana AI memproses pesan Anda
          </h1>
        </div>
        <p className="hidden shrink-0 font-mono text-[11px] text-zinc-500 sm:block">
          Langkah demi langkah · contoh nyata
        </p>
      </header>

      {/* Graph stage */}
      <div className="min-h-0 flex-1 px-6 pt-4">
        <div className="h-full overflow-hidden rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur-sm">
          <TriageGraph key="demo" pipeline={pipeline} />
        </div>
      </div>

      {/* Explanation + controls */}
      <div className="shrink-0 px-6 py-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white/85 p-4 shadow-sm backdrop-blur-sm md:flex-row md:items-center">
          {/* Current-step explanation */}
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-2xl">
              {meta.icon}
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                {meta.title}
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
                  {step + 1}/{SCRIPT.length}
                </span>
              </p>
              <AnimatePresence mode="wait">
                <motion.p
                  key={step}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="mt-1 text-sm leading-relaxed text-zinc-600"
                >
                  {current.explain}
                </motion.p>
              </AnimatePresence>
              {atEnd && summary.latencyMs != null && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-0.5 font-mono text-[11px] font-medium text-emerald-700">
                  ✓ Selesai dalam {formatDuration(summary.latencyMs)}
                </p>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => go(0)}
              disabled={step === 0 && !playing}
              aria-label="Ulang dari awal"
              className="flex size-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-40"
            >
              ↺
            </button>
            <button
              type="button"
              onClick={() => go(step - 1)}
              disabled={step === 0}
              aria-label="Langkah sebelumnya"
              className="flex size-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-40"
            >
              ◀
            </button>
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Jeda" : atEnd ? "Putar ulang" : "Putar otomatis"}
              className="flex h-10 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground transition-transform hover:scale-[1.03] active:scale-95"
            >
              {playing ? "⏸ Jeda" : atEnd ? "↺ Putar lagi" : "▶ Putar otomatis"}
            </button>
            <button
              type="button"
              onClick={() => go(step + 1)}
              disabled={atEnd}
              aria-label="Langkah berikutnya"
              className="flex size-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-40"
            >
              ▶
            </button>
          </div>
        </div>

        {/* Progress dots */}
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {SCRIPT.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`Ke langkah ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step
                  ? "w-6 bg-primary"
                  : i < step
                    ? "w-1.5 bg-emerald-400"
                    : "w-1.5 bg-zinc-300 hover:bg-zinc-400",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
