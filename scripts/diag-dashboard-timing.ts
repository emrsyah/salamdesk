import "dotenv/config"
import { sql } from "drizzle-orm"
import { db, queryClient } from "@/db"
import {
  getDashboardScalars,
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
} from "@/services/analytics.service"

async function time<T>(label: string, fn: () => Promise<T>): Promise<number> {
  const t0 = performance.now()
  await fn()
  const ms = Math.round(performance.now() - t0)
  console.log(`[DIAG-tim] ${label.padEnd(28)} ${ms} ms`)
  return ms
}

async function main() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 7)
  from.setHours(0, 0, 0, 0)
  const params = { dateRange: { from, to } }
  const g = "day" as const

  // 1. Bare round-trip baseline (network + pooler latency)
  await time("warmup select 1", () => db.execute(sql`select 1`))
  await time("baseline select 1", () => db.execute(sql`select 1`))

  // 2. Each query individually (sequential), to see per-query cost
  console.log("[DIAG-tim] --- individual (sequential) ---")
  const seqStart = performance.now()
  await time("kpis", () => getDashboardKpis(params))
  await time("volumeTrend", () => getVolumeTrend(params, g))
  await time("statusDist", () => getStatusDistribution(params))
  await time("priorityDist", () => getPriorityDistribution(params))
  await time("slaByPriority", () => getSlaByPriority(params))
  await time("moduleDist", () => getModuleDistribution(params))
  await time("sourceDist", () => getSourceDistribution(params))
  await time("responseTimeTrend", () => getResponseTimeTrend(params, g))
  await time("resolutionSplit", () => getResolutionSplit(params))
  await time("rootCauseDist", () => getRootCauseDistribution(params))
  await time("agingBacklog", () => getAgingBacklog())
  await time("staffPerformance", () => getStaffPerformance(params))
  console.log(`[DIAG-tim] sequential total: ${Math.round(performance.now() - seqStart)} ms`)

  // 3a. OLD route shape: 12 parallel queries
  const oldStart = performance.now()
  await Promise.all([
    getDashboardKpis(params),
    getVolumeTrend(params, g),
    getStatusDistribution(params),
    getPriorityDistribution(params),
    getSlaByPriority(params),
    getModuleDistribution(params),
    getSourceDistribution(params),
    getResponseTimeTrend(params, g),
    getResolutionSplit(params),
    getRootCauseDistribution(params),
    getAgingBacklog(),
    getStaffPerformance(params),
  ])
  console.log(`[DIAG-tim] OLD parallel (12 queries): ${Math.round(performance.now() - oldStart)} ms`)

  // 3b. NEW route shape: consolidated scalars + 6 others
  const newStart = performance.now()
  await Promise.all([
    getDashboardScalars(params),
    getVolumeTrend(params, g),
    getModuleDistribution(params),
    getResponseTimeTrend(params, g),
    getRootCauseDistribution(params),
    getAgingBacklog(),
    getStaffPerformance(params),
  ])
  console.log(`[DIAG-tim] NEW parallel (7 queries): ${Math.round(performance.now() - newStart)} ms`)

  // Sanity: scalars match the individual distribution queries
  const [scalars, status] = await Promise.all([
    getDashboardScalars(params),
    getStatusDistribution(params),
  ])
  const scalarResolvedTotal = scalars.kpis.find((k) => k.label === "Selesai")?.value
  console.log(
    `[DIAG-tim] sanity: scalars statuses=${scalars.status.length}, individual statuses=${status.length}, kpiSelesai=${scalarResolvedTotal}`,
  )

  // 4. Row counts for context
  const [{ count }] = (await db.execute(sql`select count(*)::int as count from tickets`)) as unknown as [
    { count: number },
  ]
  console.log(`[DIAG-tim] tickets row count: ${count}`)

  await queryClient.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
