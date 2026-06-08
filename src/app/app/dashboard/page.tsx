"use client"

import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import { RiArrowUpLine, RiArrowDownLine } from "@remixicon/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// NOTE: All numbers below are deterministic dummy data generated per range.
// The shape mirrors the analytics.service so it can later be swapped for the
// real /api/analytics payload without touching the layout.
// ---------------------------------------------------------------------------

type RangeKey = "7d" | "30d" | "90d" | "1y"

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7 Hari" },
  { key: "30d", label: "30 Hari" },
  { key: "90d", label: "90 Hari" },
  { key: "1y", label: "1 Tahun" },
]

const RANGE_SCALE: Record<RangeKey, number> = {
  "7d": 1,
  "30d": 3.8,
  "90d": 11,
  "1y": 44,
}

const RANGE_SEED: Record<RangeKey, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 }

const TREND_BUCKETS: Record<RangeKey, string[]> = {
  "7d": ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"],
  "30d": ["Mgg 1", "Mgg 2", "Mgg 3", "Mgg 4"],
  "90d": ["Bln 1", "Bln 2", "Bln 3"],
  "1y": ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
}

const PREV_LABEL: Record<RangeKey, string> = {
  "7d": "vs 7 hari sblm",
  "30d": "vs 30 hari sblm",
  "90d": "vs 90 hari sblm",
  "1y": "vs tahun sblm",
}

const MODULES = [
  "Pendaftaran",
  "Rawat Inap",
  "Farmasi",
  "Laboratorium",
  "Radiologi",
  "Kasir/Billing",
  "BPJS/SEP",
  "Rekam Medis",
]

const ROOT_CAUSES = [
  "Bug Aplikasi",
  "Input User",
  "Jaringan",
  "Hardware",
  "Konfigurasi",
  "Integrasi BPJS",
  "Lainnya",
]

const AGENTS = ["Rizki", "Sari", "Andi", "Nia", "Budi"]

const CHANNELS: { channel: string; weight: number }[] = [
  { channel: "WhatsApp", weight: 0.46 },
  { channel: "Web", weight: 0.21 },
  { channel: "Email", weight: 0.17 },
  { channel: "Manual", weight: 0.1 },
  { channel: "API", weight: 0.06 },
]

// Deterministic PRNG so the dashboard is stable across renders for a given range.
function mulberry32(seed: number) {
  let s = seed
  return function () {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Kpi = {
  label: string
  value: string
  delta: number // signed percentage
  positiveIsGood: boolean
}

function buildData(range: RangeKey) {
  const scale = RANGE_SCALE[range]
  const rand = mulberry32(RANGE_SEED[range])
  const jitter = (base: number, spread = 0.35) =>
    Math.max(0, Math.round(base * (1 + (rand() - 0.5) * spread)))

  const buckets = TREND_BUCKETS[range]
  const perBucket = (26 * scale) / buckets.length
  const volume = buckets.map((bucket) => {
    const created = jitter(perBucket)
    const resolved = Math.round(created * (0.78 + rand() * 0.2))
    return { bucket, created, resolved }
  })

  const totalCreated = volume.reduce((s, v) => s + v.created, 0)
  const totalResolved = volume.reduce((s, v) => s + v.resolved, 0)
  const open = Math.max(1, totalCreated - totalResolved)

  const statusDist = [
    { name: "open", label: "Terbuka", value: Math.round(open * 0.55) },
    { name: "progress", label: "Dikerjakan", value: Math.round(open * 0.45) },
    { name: "resolved", label: "Selesai", value: Math.round(totalResolved * 0.62) },
    { name: "closed", label: "Ditutup", value: Math.round(totalResolved * 0.38) },
  ]

  const priorityDist = [
    { name: "critical", label: "Kritis", value: jitter(totalCreated * 0.18) },
    { name: "medium", label: "Sedang", value: jitter(totalCreated * 0.5) },
    { name: "low", label: "Rendah", value: jitter(totalCreated * 0.32) },
  ]

  const mkSla = (total: number, breachRate: number) => {
    const breached = Math.round(total * breachRate)
    const warning = Math.round(total * breachRate * 0.85)
    const safe = Math.max(0, total - breached - warning)
    return { safe, warning, breached }
  }
  const slaByPriority = [
    { priority: "Kritis", ...mkSla(priorityDist[0].value, 0.24) },
    { priority: "Sedang", ...mkSla(priorityDist[1].value, 0.11) },
    { priority: "Rendah", ...mkSla(priorityDist[2].value, 0.05) },
  ]
  const totalSla = slaByPriority.reduce(
    (s, r) => s + r.safe + r.warning + r.breached,
    0,
  )
  const breachedTotal = slaByPriority.reduce((s, r) => s + r.breached, 0)
  const slaCompliance = totalSla
    ? Math.round(((totalSla - breachedTotal) / totalSla) * 100)
    : 0

  const moduleDist = MODULES.map((module) => ({
    module,
    tickets: jitter(totalCreated / MODULES.length, 0.7),
  })).sort((a, b) => b.tickets - a.tickets)

  const channelDist = CHANNELS.map(({ channel, weight }) => ({
    channel,
    tickets: jitter(totalCreated * weight),
  }))

  const responseTime = volume.map((v, i) => ({
    bucket: v.bucket,
    avg: jitter(Math.max(12, 42 - i * 1.4), 0.18),
  }))
  const avgResponse = Math.round(
    responseTime.reduce((s, r) => s + r.avg, 0) / responseTime.length,
  )

  const aiResolved = Math.round(totalResolved * (0.3 + rand() * 0.1))
  const escalated = Math.round(totalResolved * 0.08)
  const agentResolved = Math.max(0, totalResolved - aiResolved - escalated)
  const resolutionDist = [
    { name: "ai", label: "AI", value: aiResolved },
    { name: "agent", label: "Agent", value: agentResolved },
    { name: "escalated", label: "Eskalasi", value: escalated },
  ]
  const aiDeflection = totalResolved
    ? Math.round((aiResolved / totalResolved) * 100)
    : 0

  const rootCauseDist = ROOT_CAUSES.map((cause) => ({
    cause,
    value: jitter((totalResolved / ROOT_CAUSES.length) * 1.2, 0.6),
  })).sort((a, b) => b.value - a.value)

  const agingBacklog = [
    { bucket: "< 1 hari", tickets: jitter(open * 0.42) },
    { bucket: "1–3 hari", tickets: jitter(open * 0.3) },
    { bucket: "3–7 hari", tickets: jitter(open * 0.18) },
    { bucket: "> 7 hari", tickets: jitter(open * 0.1) },
  ]

  const agentPerf = AGENTS.map((name) => {
    const assigned = jitter((totalResolved / AGENTS.length) * 1.15, 0.4)
    const resolved = Math.round(assigned * (0.7 + rand() * 0.25))
    return { name, assigned, resolved }
  })

  const signedDelta = (mag: number) => Math.round((rand() - 0.4) * mag)
  const summary: Kpi[] = [
    { label: "Total Tiket", value: `${totalCreated}`, delta: signedDelta(28), positiveIsGood: true },
    { label: "Belum Selesai", value: `${open}`, delta: signedDelta(24), positiveIsGood: false },
    { label: "Selesai", value: `${totalResolved}`, delta: signedDelta(30), positiveIsGood: true },
    { label: "Avg Respons", value: `${avgResponse}m`, delta: signedDelta(22), positiveIsGood: false },
    { label: "Kepatuhan SLA", value: `${slaCompliance}%`, delta: signedDelta(14), positiveIsGood: true },
    { label: "Defleksi AI", value: `${aiDeflection}%`, delta: signedDelta(18), positiveIsGood: true },
  ]

  return {
    summary,
    volume,
    statusDist,
    priorityDist,
    slaByPriority,
    moduleDist,
    channelDist,
    responseTime,
    resolutionDist,
    rootCauseDist,
    agingBacklog,
    agentPerf,
  }
}

const trendConfig = {
  created: { label: "Dibuat", color: "var(--chart-1)" },
  resolved: { label: "Selesai", color: "var(--chart-2)" },
} satisfies ChartConfig

const statusConfig = {
  value: { label: "Tiket" },
  open: { label: "Terbuka", color: "var(--chart-1)" },
  progress: { label: "Dikerjakan", color: "var(--chart-3)" },
  resolved: { label: "Selesai", color: "var(--chart-2)" },
  closed: { label: "Ditutup", color: "var(--chart-5)" },
} satisfies ChartConfig

const priorityConfig = {
  value: { label: "Tiket" },
  critical: { label: "Kritis", color: "#dc2626" },
  medium: { label: "Sedang", color: "#d97706" },
  low: { label: "Rendah", color: "#2563eb" },
} satisfies ChartConfig

const slaConfig = {
  safe: { label: "Aman", color: "#16a34a" },
  warning: { label: "Peringatan", color: "#d97706" },
  breached: { label: "Terlampaui", color: "#dc2626" },
} satisfies ChartConfig

const moduleConfig = {
  tickets: { label: "Tiket", color: "var(--chart-4)" },
} satisfies ChartConfig

const channelConfig = {
  tickets: { label: "Tiket", color: "var(--chart-1)" },
} satisfies ChartConfig

const responseConfig = {
  avg: { label: "Menit", color: "var(--chart-5)" },
} satisfies ChartConfig

const resolutionConfig = {
  value: { label: "Tiket" },
  ai: { label: "AI", color: "#7c3aed" },
  agent: { label: "Agent", color: "#2563eb" },
  escalated: { label: "Eskalasi", color: "#dc2626" },
} satisfies ChartConfig

const rootCauseConfig = {
  value: { label: "Tiket", color: "var(--chart-3)" },
} satisfies ChartConfig

const agingConfig = {
  tickets: { label: "Tiket", color: "#d97706" },
} satisfies ChartConfig

const agentConfig = {
  assigned: { label: "Ditangani", color: "var(--chart-3)" },
  resolved: { label: "Selesai", color: "var(--chart-2)" },
} satisfies ChartConfig

function KpiCard({ kpi, prevLabel }: { kpi: Kpi; prevLabel: string }) {
  const up = kpi.delta >= 0
  const good = up === kpi.positiveIsGood
  const Arrow = up ? RiArrowUpLine : RiArrowDownLine
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{kpi.label}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-2xl font-bold">{kpi.value}</p>
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-medium",
              good ? "text-green-600" : "text-red-600",
            )}
          >
            <Arrow className="size-3" />
            {Math.abs(kpi.delta)}%
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{prevLabel}</p>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>("7d")
  const data = useMemo(() => buildData(range), [range])
  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? ""

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header + range selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Ringkasan performa helpdesk SIMRS · {rangeLabel}{" "}
            <span className="text-xs">(data dummy)</span>
          </p>
        </div>
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                range === r.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {data.summary.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} prevLabel={PREV_LABEL[range]} />
        ))}
      </div>

      {/* Trend + status */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Tren Tiket</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={trendConfig} className="aspect-auto h-[260px] w-full">
              <AreaChart data={data.volume} margin={{ left: 4, right: 12, top: 8 }}>
                <defs>
                  <linearGradient id="fillCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-created)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="var(--color-created)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-resolved)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="var(--color-resolved)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Area type="monotone" dataKey="created" stroke="var(--color-created)" fill="url(#fillCreated)" strokeWidth={2} stackId="a" />
                <Area type="monotone" dataKey="resolved" stroke="var(--color-resolved)" fill="url(#fillResolved)" strokeWidth={2} stackId="b" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribusi Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={statusConfig} className="mx-auto aspect-square h-[260px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                <Pie data={data.statusDist} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} strokeWidth={2}>
                  {data.statusDist.map((e) => (
                    <Cell key={e.name} fill={`var(--color-${e.name})`} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Module load + priority */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Tiket per Modul SIMRS</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={moduleConfig} className="aspect-auto h-[300px] w-full">
              <BarChart data={data.moduleDist} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis type="category" dataKey="module" width={100} tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
                <Bar dataKey="tickets" fill="var(--color-tickets)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribusi Prioritas</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={priorityConfig} className="mx-auto aspect-square h-[300px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                <Pie data={data.priorityDist} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} strokeWidth={2}>
                  {data.priorityDist.map((e) => (
                    <Cell key={e.name} fill={`var(--color-${e.name})`} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* SLA + resolution + channel */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">SLA per Prioritas</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={slaConfig} className="aspect-auto h-[260px] w-full">
              <BarChart data={data.slaByPriority} margin={{ left: 4, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="priority" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="safe" stackId="s" fill="var(--color-safe)" />
                <Bar dataKey="warning" stackId="s" fill="var(--color-warning)" />
                <Bar dataKey="breached" stackId="s" fill="var(--color-breached)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resolusi: AI vs Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={resolutionConfig} className="mx-auto aspect-square h-[260px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                <Pie data={data.resolutionDist} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} strokeWidth={2}>
                  {data.resolutionDist.map((e) => (
                    <Cell key={e.name} fill={`var(--color-${e.name})`} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tiket per Channel</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={channelConfig} className="aspect-auto h-[260px] w-full">
              <BarChart data={data.channelDist} margin={{ left: 4, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="channel" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
                <Bar dataKey="tickets" fill="var(--color-tickets)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Response time + aging */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rata-rata Waktu Respon (menit)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={responseConfig} className="aspect-auto h-[260px] w-full">
              <LineChart data={data.responseTime} margin={{ left: 4, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                <Line type="monotone" dataKey="avg" stroke="var(--color-avg)" strokeWidth={2} dot={{ r: 4, fill: "var(--color-avg)" }} activeDot={{ r: 6 }} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Backlog Aging (tiket terbuka)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={agingConfig} className="aspect-auto h-[260px] w-full">
              <BarChart data={data.agingBacklog} margin={{ left: 4, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
                <Bar dataKey="tickets" fill="var(--color-tickets)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Root cause + agent performance */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribusi Root Cause</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={rootCauseConfig} className="aspect-auto h-[280px] w-full">
              <BarChart data={data.rootCauseDist} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis type="category" dataKey="cause" width={100} tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performa Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={agentConfig} className="aspect-auto h-[280px] w-full">
              <BarChart data={data.agentPerf} margin={{ left: 4, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="assigned" fill="var(--color-assigned)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="resolved" fill="var(--color-resolved)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
