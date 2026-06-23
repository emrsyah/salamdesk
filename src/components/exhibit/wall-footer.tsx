"use client";

import { QRCodeSVG } from "qrcode.react";
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

      {/* Scan-to-try, pinned right */}
      {waLink && (
        <div className="ml-auto flex items-center gap-2.5">
          <div className="leading-tight text-right">
            <p className="text-sm font-semibold text-zinc-900">Coba sendiri 👋</p>
            <p className="font-mono text-[10px] text-zinc-500">
              Pindai · chat · lihat di layar
            </p>
          </div>
          <div className="rounded-md border border-zinc-200 bg-white p-1">
            <QRCodeSVG value={waLink} size={44} level="M" />
          </div>
        </div>
      )}
    </footer>
  );
}
