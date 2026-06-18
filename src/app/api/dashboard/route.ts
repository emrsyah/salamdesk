import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import {
  getDashboardScalars,
  getVolumeTrend,
  getModuleDistribution,
  getResponseTimeTrend,
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

  const [scalars, volume, moduleRaw, responseTime, rootCauseRaw, agingBacklog, staffPerf] =
    await Promise.all([
      getDashboardScalars(params),
      getVolumeTrend(params, groupBy),
      getModuleDistribution(params),
      getResponseTimeTrend(params, groupBy),
      getRootCauseDistribution(params),
      getAgingBacklog(moduleParam),
      canSeeStaffPerf ? getStaffPerformance(params) : Promise.resolve(null),
    ])

  return NextResponse.json({
    summary: scalars.kpis,
    volume: volume.map((v) => ({ bucket: v.period, created: v.created, resolved: v.resolved })),
    statusDist: scalars.status.map((r) => ({
      name: r.key,
      label: STATUS_LABELS[r.key] ?? r.key,
      value: r.count,
    })),
    priorityDist: scalars.priority.map((r) => ({
      name: r.key,
      label: PRIORITY_LABELS[r.key] ?? r.key,
      value: r.count,
    })),
    slaByPriority: scalars.slaByPriority.map((r) => ({
      priority: PRIORITY_LABELS[r.priority] ?? r.priority,
      safe: r.safe,
      warning: r.warning,
      breached: r.breached,
    })),
    moduleDist: moduleRaw.map((r) => ({ module: r.moduleName, tickets: r.count })),
    channelDist: scalars.source.map((r) => ({
      channel: SOURCE_LABELS[r.key] ?? r.key,
      tickets: r.count,
    })),
    responseTime: responseTime.map((r) => ({ bucket: r.period, avg: r.avg })),
    resolutionDist: [
      { name: "ai", label: "AI", value: scalars.resolution.ai },
      { name: "agent", label: "Agent", value: scalars.resolution.agent },
      { name: "escalated", label: "Eskalasi", value: scalars.resolution.escalated },
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
