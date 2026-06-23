"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { useExhibitStream } from "@/app/exhibit/exhibit-stream-context";

const MODULE_COLORS = [
  "#818cf8",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#22d3ee",
  "#a78bfa",
  "#fb923c",
];

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className={`mt-0.5 text-2xl font-semibold ${accent ?? "text-zinc-100"}`}>
        {value}
      </p>
    </div>
  );
}

/**
 * Right-hand metrics. Charts run with `isAnimationActive={false}` — recharts
 * re-triggers its full animation on every data change, which stutters badly on
 * a frequently-updating stream, so we disable it and let the values snap.
 */
export function StatsPanel() {
  const { metrics } = useExhibitStream();

  const moduleData = Object.entries(metrics.moduleCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  const kbHitRate =
    metrics.kbSearches > 0
      ? Math.round((metrics.kbHits / metrics.kbSearches) * 100)
      : 0;
  const totalReplies = metrics.autoReplied + metrics.drafted;
  const autoRate =
    totalReplies > 0
      ? Math.round((metrics.autoReplied / totalReplies) * 100)
      : 0;

  return (
    <div className="flex h-full flex-col gap-4">
      <h2 className="shrink-0 font-mono text-xs uppercase tracking-widest text-zinc-500">
        Statistics
      </h2>

      <div className="grid grid-cols-2 gap-2">
        <StatTile
          label="Tiket / menit"
          value={metrics.ticketsPerMin}
          accent="text-sky-400"
        />
        <StatTile
          label="Auto-reply"
          value={`${autoRate}%`}
          accent="text-emerald-400"
        />
        <StatTile label="KB hit rate" value={`${kbHitRate}%`} accent="text-teal-400" />
        <StatTile
          label="Off-topic blocked"
          value={metrics.offTopicBlocked}
          accent="text-rose-400"
        />
        <StatTile label="Tool calls" value={metrics.toolCalls} accent="text-orange-400" />
        <StatTile label="Draf untuk staf" value={metrics.drafted} accent="text-amber-400" />
      </div>

      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          Modul teratas
        </p>
        {moduleData.length === 0 ? (
          <p className="py-8 text-center text-xs text-zinc-600">Belum ada data</p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="h-32 w-32 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={moduleData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={36}
                    outerRadius={60}
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
            </div>
            <ul className="flex-1 space-y-1">
              {moduleData.map((m, i) => (
                <li key={m.name} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ background: MODULE_COLORS[i % MODULE_COLORS.length] }}
                  />
                  <span className="truncate text-zinc-300">{m.name}</span>
                  <span className="ml-auto font-mono text-zinc-500">{m.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
