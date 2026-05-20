"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useQueryParams } from "@/hooks/use-query-params"

// ─── Types ────────────────────────────────────────────────

type AnalyticsData = {
  summary: { total: number; open: number; resolved: number; slaBreached: number }
  volume: { period: string; count: number }[]
  statusDist: { status: string; count: number }[]
  priorityDist: { priority: string; count: number }[]
  slaOverview: { slaStatus: string; count: number }[]
  moduleDist: { moduleId: string; moduleName: string; moduleColor: string; count: number }[]
  sourceDist: { source: string; count: number }[]
  resolution: { totalResolved: number; resolvedByAi: number; resolvedByUser: number; avgResolutionMinutes: number | null }
  staffPerf: { staffId: string; staffName: string; assignedCount: number; resolvedCount: number; avgResolutionMinutes: number | null }[] | null
  rootCause: { rootCause: string; count: number }[]
}

type ModuleOption = { id: string; name: string }

type PieEntry = Record<string, string | number>

// ─── Constants ────────────────────────────────────────────

const RANGE_OPTIONS = [
  { value: "7d", label: "7 Hari" },
  { value: "30d", label: "30 Hari" },
  { value: "90d", label: "90 Hari" },
  { value: "1y", label: "1 Tahun" },
]

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting: "Waiting",
  resolved: "Resolved",
  closed: "Closed",
}

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  critical: "Critical",
}

const SLA_LABELS: Record<string, string> = {
  safe: "Aman",
  warning: "Warning",
  breached: "Breached",
}

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  web: "Web",
  email: "Email",
  manual: "Manual",
  api: "API",
}

const ROOT_CAUSE_LABELS: Record<string, string> = {
  bug: "Bug",
  user_error: "User Error",
  network: "Network",
  third_party: "Third Party",
  configuration: "Configuration",
  hardware: "Hardware",
  other: "Other",
}

const STATUS_COLORS: Record<string, string> = {
  open: "#3b82f6",
  in_progress: "#f59e0b",
  waiting: "#8b5cf6",
  resolved: "#22c55e",
  closed: "#6b7280",
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  critical: "#ef4444",
}

const SLA_COLORS: Record<string, string> = {
  safe: "#22c55e",
  warning: "#f59e0b",
  breached: "#ef4444",
}

const SOURCE_COLORS: Record<string, string> = {
  whatsapp: "#25D366",
  web: "#3b82f6",
  email: "#8b5cf6",
  manual: "#f59e0b",
  api: "#06b6d4",
}

const ROOT_CAUSE_COLORS: Record<string, string> = {
  bug: "#ef4444",
  user_error: "#f59e0b",
  network: "#3b82f6",
  third_party: "#8b5cf6",
  configuration: "#06b6d4",
  hardware: "#6b7280",
  other: "#94a3b8",
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "-"
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}j ${m}m` : `${h}j`
}

// ─── Sub-components ───────────────────────────────────────

function SummaryCards({ summary }: { summary: AnalyticsData["summary"] }) {
  const cards = [
    { label: "Total Tiket", value: summary.total, color: "text-blue-600" },
    { label: "Open", value: summary.open, color: "text-amber-600" },
    { label: "Resolved", value: summary.resolved, color: "text-green-600" },
    { label: "SLA Breached", value: summary.slaBreached, color: "text-red-600" },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function TicketVolumeChart({ data }: { data: AnalyticsData["volume"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Volume Tiket</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} className="text-muted-foreground" />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="text-muted-foreground" />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Tiket" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function DistributionPieChart({
  title,
  data,
  nameKey,
  dataKey,
  labelMap,
  colorMap,
}: {
  title: string
  data: PieEntry[]
  nameKey: string
  dataKey: string
  labelMap: Record<string, string>
  colorMap: Record<string, string>
}) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Tidak ada data</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              nameKey={nameKey}
              dataKey={dataKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={(labelProps: { payload?: PieEntry; index?: number }) => {
                const entry = labelProps.payload ?? data[labelProps.index ?? 0]
                if (!entry) return ""
                return `${labelMap[String(entry[nameKey])] ?? String(entry[nameKey])} (${entry[dataKey]})`
              }}
              labelLine={false}
            >
              {data.map((entry) => (
                <Cell
                  key={String(entry[nameKey])}
                  fill={colorMap[String(entry[nameKey])] ?? "#6b7280"}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(_value: unknown, _name: unknown, item: { payload?: PieEntry }) => [
                item.payload?.[dataKey] ?? "",
                labelMap[String(item.payload?.[nameKey])] ?? String(item.payload?.[nameKey]),
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function ModuleBarChart({ data }: { data: AnalyticsData["moduleDist"] }) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tiket per Modul</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Tidak ada data</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tiket per Modul</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="moduleName" tick={{ fontSize: 12 }} width={120} />
            <Tooltip />
            <Bar dataKey="count" name="Tiket" radius={[0, 4, 4, 0]}>
              {data.map((entry) => (
                <Cell key={entry.moduleId} fill={entry.moduleColor || "#6b7280"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function ResolutionCard({ data }: { data: AnalyticsData["resolution"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resolusi</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Total Resolved</span>
            <span className="text-sm font-semibold">{data.totalResolved}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Resolusi oleh AI</span>
            <span className="text-sm font-semibold text-purple-600">{data.resolvedByAi}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Resolusi oleh User</span>
            <span className="text-sm font-semibold text-blue-600">{data.resolvedByUser}</span>
          </div>
          <div className="flex justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">Rata-rata Waktu Resolusi</span>
            <span className="text-sm font-semibold">{formatMinutes(data.avgResolutionMinutes)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StaffPerformanceTable({ data }: { data: NonNullable<AnalyticsData["staffPerf"]> }) {
  if (!data || !data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performa Tim</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Tidak ada data</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Performa Tim</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Staff</th>
                <th className="pb-2 pr-4 font-medium">Ditangani</th>
                <th className="pb-2 pr-4 font-medium">Resolved</th>
                <th className="pb-2 font-medium">Rata-rata</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.staffId} className="border-b last:border-0">
                  <td className="py-2 pr-4">{row.staffName}</td>
                  <td className="py-2 pr-4">{row.assignedCount}</td>
                  <td className="py-2 pr-4">{row.resolvedCount}</td>
                  <td className="py-2">{formatMinutes(row.avgResolutionMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Loading State ────────────────────────────────────────

function AnalyticsSkeleton() {
  const skeletonKeys = ["header", "card1", "card2", "card3", "card4", "chart1", "chart2"]
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {skeletonKeys.slice(1, 5).map((key) => (
          <Skeleton key={key} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────

export default function AnalyticPage() {
  const { searchParams, setQueryParam } = useQueryParams()

  const range = searchParams.get("range") || "7d"
  const module = searchParams.get("module") || ""

  const [data, setData] = useState<AnalyticsData | null>(null)
  const [modules, setModules] = useState<ModuleOption[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ range })
      if (module) params.set("module", module)
      const res = await fetch(`/api/analytics?${params.toString()}`)
      if (res.ok) {
        setData(await res.json())
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err)
    } finally {
      setLoading(false)
    }
  }, [range, module])

  const fetchModules = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/modules")
      if (res.ok) setModules(await res.json())
    } catch {
      // modules load silently
    }
  }, [])

  useEffect(() => {
    fetchAnalytics()
    fetchModules()
  }, [fetchAnalytics, fetchModules])

  if (loading || !data) {
    return <AnalyticsSkeleton />
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Dashboard analitik dan metrik tiket</p>
        </div>
        <div className="flex gap-2">
          <Select
            value={range}
            onValueChange={(v) => setQueryParam("range", v === "7d" ? null : v, { replace: true })}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={module || "all"}
            onValueChange={(v) => setQueryParam("module", v === "all" ? null : v, { replace: true })}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Semua Modul" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Modul</SelectItem>
              {modules.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards summary={data.summary} />

      {/* Volume Chart */}
      <TicketVolumeChart data={data.volume} />

      {/* Distributions Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <DistributionPieChart
          title="Status Tiket"
          data={data.statusDist}
          nameKey="status"
          dataKey="count"
          labelMap={STATUS_LABELS}
          colorMap={STATUS_COLORS}
        />
        <DistributionPieChart
          title="Prioritas"
          data={data.priorityDist}
          nameKey="priority"
          dataKey="count"
          labelMap={PRIORITY_LABELS}
          colorMap={PRIORITY_COLORS}
        />
        <DistributionPieChart
          title="Status SLA"
          data={data.slaOverview}
          nameKey="slaStatus"
          dataKey="count"
          labelMap={SLA_LABELS}
          colorMap={SLA_COLORS}
        />
      </div>

      {/* Module & Resolution */}
      <div className="grid gap-4 md:grid-cols-2">
        <ModuleBarChart data={data.moduleDist} />
        <div className="space-y-4">
          <ResolutionCard data={data.resolution} />
          <DistributionPieChart
            title="Sumber Tiket"
            data={data.sourceDist}
            nameKey="source"
            dataKey="count"
            labelMap={SOURCE_LABELS}
            colorMap={SOURCE_COLORS}
          />
        </div>
      </div>

      {/* Root Cause */}
      <DistributionPieChart
        title="Root Cause"
        data={data.rootCause.filter((r) => r.rootCause !== null)}
        nameKey="rootCause"
        dataKey="count"
        labelMap={ROOT_CAUSE_LABELS}
        colorMap={ROOT_CAUSE_COLORS}
      />

      {/* Staff Performance */}
      {data.staffPerf && <StaffPerformanceTable data={data.staffPerf} />}
    </div>
  )
}
