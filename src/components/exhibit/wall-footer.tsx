"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion } from "motion/react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { useExhibitStream } from "@/app/exhibit/exhibit-stream-context";

// Module donut palette — DESIGN status spectrum at 600-level.
const MODULE_COLORS = [
  "#7c3aed", "#059669", "#d97706", "#0284c7", "#dc2626", "#ea580c", "#64748b",
];

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`font-mono text-lg font-bold tabular-nums ${tone ?? "text-zinc-900"}`}>
        {value}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
    </div>
  );
}

/**
 * The wall's secondary metrics, demoted from a full column to a slim strip so
 * the triage engine owns the stage. Carries only what the header doesn't: the
 * top-module mix, KB hit rate, guardrail blocks, tool calls, drafts — plus the
 * "scan to try" QR pinned right.
 */
/** Tap-to-enlarge QR — a footer thumbnail that opens a big, scannable modal. */
function ScanToTry({ waLink }: { waLink: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-auto flex items-center gap-2.5 rounded-xl p-1 text-right transition-colors hover:bg-zinc-100"
        aria-label="Perbesar kode QR untuk dipindai"
      >
        <div className="leading-tight">
          <p className="text-sm font-semibold text-zinc-900">Coba sendiri 👋</p>
          <p className="font-mono text-[10px] text-zinc-500">Klik untuk perbesar &amp; pindai</p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-1">
          <QRCodeSVG value={waLink} size={48} level="M" />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Pindai untuk mencoba"
          >
            <motion.div
              initial={{ scale: 0.92, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="relative flex flex-col items-center rounded-3xl border border-zinc-200 bg-white p-8 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup"
                className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
              >
                ✕
              </button>
              <p className="mb-1 text-xl font-bold tracking-tight text-zinc-950">
                Pindai untuk mulai 👋
              </p>
              <p className="mb-6 max-w-xs text-center text-sm text-zinc-500">
                Buka kamera WhatsApp, arahkan ke kode ini, lalu kirim pesan — agen
                kami menjawab langsung di layar.
              </p>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <QRCodeSVG value={waLink} size={300} level="M" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function WallFooter({ waLink }: { waLink: string | null }) {
  const { metrics } = useExhibitStream();

  const moduleData = Object.entries(metrics.moduleCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);
  const topModule = moduleData[0]?.name ?? null;

  const kbHitRate =
    metrics.kbSearches > 0
      ? Math.round((metrics.kbHits / metrics.kbSearches) * 100)
      : 0;

  return (
    <footer className="flex shrink-0 items-center gap-5 border-t border-border/60 bg-background/70 px-6 py-2.5 backdrop-blur-md">
      {/* Module mix */}
      <div className="flex items-center gap-2.5">
        <div className="size-11 shrink-0">
          {moduleData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={moduleData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={13}
                  outerRadius={22}
                  paddingAngle={2}
                  isAnimationActive={false}
                  stroke="none"
                >
                  {moduleData.map((_, i) => (
                    <Cell key={i} fill={MODULE_COLORS[i % MODULE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="size-11 rounded-full border-[5px] border-zinc-100" />
          )}
        </div>
        <div className="leading-tight">
          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Modul teratas
          </p>
          <p className="max-w-[9rem] truncate text-sm font-semibold text-zinc-900">
            {topModule ?? "Belum ada"}
          </p>
        </div>
      </div>

      <div className="h-7 w-px bg-border" />

      <Stat label="KB hit" value={`${kbHitRate}%`} tone="text-emerald-600" />
      <Stat label="Di luar topik" value={metrics.offTopicBlocked} tone="text-red-600" />
      <Stat label="Tool" value={metrics.toolCalls} tone="text-amber-600" />
      <Stat label="Draf staf" value={metrics.drafted} tone="text-amber-600" />

      {/* Scan-to-try, pinned right — click to enlarge */}
      {waLink && <ScanToTry waLink={waLink} />}
    </footer>
  );
}
