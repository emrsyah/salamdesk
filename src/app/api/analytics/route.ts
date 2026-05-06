import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import {
  getSummaryStats,
  getTicketVolume,
  getStatusDistribution,
  getPriorityDistribution,
  getSlaOverview,
  getModuleDistribution,
  getSourceDistribution,
  getResolutionBreakdown,
  getAgentPerformance,
  getRootCauseDistribution,
} from "@/services/analytics.service"

const RANGE_MAP: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
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

  // Only admins and engineers can see agent performance data
  const canSeeAgentPerf = user.role === "admin" || user.role === "engineer"

  const [
    summary,
    volume,
    statusDist,
    priorityDist,
    slaOverview,
    moduleDist,
    sourceDist,
    resolution,
    agentPerf,
    rootCause,
  ] = await Promise.all([
    getSummaryStats(params),
    getTicketVolume(params, days <= 30 ? "day" : days <= 90 ? "week" : "month"),
    getStatusDistribution(params),
    getPriorityDistribution(params),
    getSlaOverview(params),
    getModuleDistribution(params),
    getSourceDistribution(params),
    getResolutionBreakdown(params),
    canSeeAgentPerf ? getAgentPerformance(params) : Promise.resolve(null),
    getRootCauseDistribution(params),
  ])

  return NextResponse.json({
    summary,
    volume,
    statusDist,
    priorityDist,
    slaOverview,
    moduleDist,
    sourceDist,
    resolution,
    agentPerf,
    rootCause,
  })
}
