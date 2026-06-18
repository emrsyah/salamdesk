"use client"

import { useCallback, useEffect, useState } from "react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type RangeKey = "7d" | "30d" | "90d" | "1y"

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7 Hari" },
  { key: "30d", label: "30 Hari" },
  { key: "90d", label: "90 Hari" },
  { key: "1y", label: "1 Tahun" },
]

const PREV_LABEL: Record<RangeKey, string> = {
  "7d": "vs 7 hari sblm",
  "30d": "vs 30 hari sblm",
  "90d": "vs 90 hari sblm",
  "1y": "vs tahun sblm",
}

type Kpi = {
  label: string
  value: string
  delta: number | null // signed percentage; null when no prior baseline
  positiveIsGood: boolean
}

type NamedSlice = { name: string; label: string; value: number }

type DashboardData = {
  summary: Kpi[]
  volume: { bucket: string; created: number; resolved: number }[]
  statusDist: NamedSlice[]
  priorityDist: NamedSlice[]
  slaByPriority: { priority: string; safe: number; warning: number; breached: number }[]
  moduleDist: { module: string; tickets: number }[]
  channelDist: { channel: string; tickets: number }[]
  responseTime: { bucket: string; avg: number }[]
  resolutionDist: NamedSlice[]
  rootCauseDist: { cause: string; value: number }[]
  agingBacklog: { bucket: string; tickets: number }[]
  agentPerf: { name: string; assigned: number; resolved: number }[]
}

const trendConfig = {
  created: { label: "Dibuat", color: "var(--chart-1)" },
  resolved: { label: "Selesai", color: "var(--chart-2)" },
} satisfies ChartConfig

const statusConfig = {
  value: { label: "Tiket" },
  open: { label: "Terbuka", color: "var(--chart-1)" },
  in_progress: { label: "Dikerjakan", color: "var(--chart-3)" },
  waiting: { label: "Menunggu", color: "var(--chart-4)" },
  resolved: { label: "Selesai", color: "var(--chart-2)" },
  closed: { label: "Ditutup", color: "var(--chart-5)" },
} satisfies ChartConfig

const priorityConfig = {
  value: { label: "Tiket" },
  critical: { label: "Kritis", color: "#dc2626" },
  medium: { label: "Normal", color: "#d97706" },
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
  const hasDelta = kpi.delta !== null
  const up = (kpi.delta ?? 0) >= 0
  const good = up === kpi.positiveIsGood
  const Arrow = up ? RiArrowUpLine : RiArrowDownLine
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{kpi.label}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-2xl font-bold">{kpi.value}</p>
          {hasDelta ? (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium",
                good ? "text-green-600" : "text-red-600",
              )}
            >
              <Arrow className="size-3" />
              {Math.abs(kpi.delta as number)}%
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{prevLabel}</p>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>("7d")
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? ""

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard?range=${range}`)
      if (res.ok) setData(await res.json())
    } catch (err) {
      console.error("Failed to fetch dashboard:", err)
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const rangeSelector = (
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
  )

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Ringkasan performa helpdesk SIMRS · {rangeLabel}</p>
      </div>
      {rangeSelector}
    </div>
  )

  if (loading || !data) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        {header}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[280px] rounded-lg" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[320px] rounded-lg lg:col-span-2" />
          <Skeleton className="h-[320px] rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header + range selector */}
      {header}

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
