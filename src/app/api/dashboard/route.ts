import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import {
  getDashboardKpis,
  getVolumeTrend,
  getStatusDistribution,
  getPriorityDistribution,
  getSlaByPriority,
  getModuleDistribution,
  getSourceDistribution,
  getResponseTimeTrend,
  getResolutionSplit,
  getRootCauseDistribution,
  getAgingBacklog,
  getStaffPerformance,
  type Granularity,
} from "@/services/analytics.service"

const RANGE_MAP: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 }

const STATUS_LABELS: Record<string, string> = {
  open: "Terbuka",
  in_progress: "Dikerjakan",
  waiting: "Menunggu",
  resolved: "Selesai",
  closed: "Ditutup",
}
const PRIORITY_LABELS: Record<string, string> = { low: "Rendah", medium: "Normal", critical: "Kritis" }
const SOURCE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  web: "Web",
  email: "Email",
  manual: "Manual",
  api: "API",
}
const ROOT_CAUSE_LABELS: Record<string, string> = {
  bug: "Bug Aplikasi",
  user_error: "Input User",
  network: "Jaringan",
  third_party: "Integrasi Pihak Ketiga",
  configuration: "Konfigurasi",
  hardware: "Hardware",
  other: "Lainnya",
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = session.user as typeof session.user & { role: string }
  const { searchParams } = new URL(request.url)
  const rangeParam = searchParams.get("range") || "7d"
  const moduleParam = searchParams.get("module") || undefined
  const days = RANGE_MAP[rangeParam] ?? 7

  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - days)
  from.setHours(0, 0, 0, 0)

  const params = { dateRange: { from, to }, moduleId: moduleParam }
  const groupBy: Granularity = days <= 30 ? "day" : days <= 90 ? "week" : "month"
  const canSeeStaffPerf = ["owner", "admin", "supervisor", "engineer"].includes(user.role)

  const [
    summary,
    volume,
    statusRaw,
    priorityRaw,
    slaByPriority,
    moduleRaw,
    sourceRaw,
    responseTime,
    resolution,
    rootCauseRaw,
    agingBacklog,
    staffPerf,
  ] = await Promise.all([
    getDashboardKpis(params),
    getVolumeTrend(params, groupBy),
    getStatusDistribution(params),
    getPriorityDistribution(params),
    getSlaByPriority(params),
    getModuleDistribution(params),
    getSourceDistribution(params),
    getResponseTimeTrend(params, groupBy),
    getResolutionSplit(params),
    getRootCauseDistribution(params),
    getAgingBacklog(moduleParam),
    canSeeStaffPerf ? getStaffPerformance(params) : Promise.resolve(null),
  ])

  return NextResponse.json({
    summary,
    volume: volume.map((v) => ({ bucket: v.period, created: v.created, resolved: v.resolved })),
    statusDist: statusRaw.map((r) => ({
      name: r.status,
      label: STATUS_LABELS[r.status] ?? r.status,
      value: r.count,
    })),
    priorityDist: priorityRaw.map((r) => ({
      name: r.priority,
      label: PRIORITY_LABELS[r.priority] ?? r.priority,
      value: r.count,
    })),
    slaByPriority: slaByPriority.map((r) => ({
      priority: PRIORITY_LABELS[r.priority] ?? r.priority,
      safe: r.safe,
      warning: r.warning,
      breached: r.breached,
    })),
    moduleDist: moduleRaw.map((r) => ({ module: r.moduleName, tickets: r.count })),
    channelDist: sourceRaw.map((r) => ({
      channel: SOURCE_LABELS[r.source] ?? r.source,
      tickets: r.count,
    })),
    responseTime: responseTime.map((r) => ({ bucket: r.period, avg: r.avg })),
    resolutionDist: [
      { name: "ai", label: "AI", value: resolution.ai },
      { name: "agent", label: "Agent", value: resolution.agent },
      { name: "escalated", label: "Eskalasi", value: resolution.escalated },
    ],
    rootCauseDist: rootCauseRaw
      .filter((r) => r.rootCause !== null)
      .map((r) => ({ cause: ROOT_CAUSE_LABELS[r.rootCause as string] ?? r.rootCause, value: r.count })),
    agingBacklog,
    agentPerf: (staffPerf ?? []).map((s) => ({
      name: s.staffName,
      assigned: s.assignedCount,
      resolved: s.resolvedCount,
    })),
  })
}
