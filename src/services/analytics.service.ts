import { db } from "@/db"
import { tickets, ticketEscalations } from "@/db/schema/tickets"
import { modules } from "@/db/schema/modules"
import { users } from "@/db/schema/users"
import { sql, eq, and, gte, lte, isNotNull } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"

export type Granularity = "day" | "week" | "month"

/** Postgres date-bucket expression for a timestamp column at a given granularity. */
function bucketCol(col: AnyPgColumn, groupBy: Granularity) {
  if (groupBy === "month") return sql<string>`to_char(${col}, 'YYYY-MM')`
  if (groupBy === "week")
    return sql<string>`to_char(date_trunc('week', ${col}), 'YYYY-MM-DD')`
  return sql<string>`to_char(${col}, 'YYYY-MM-DD')`
}

export type DateRange = {
  from: Date
  to: Date
}

export type AnalyticsParams = {
  dateRange: DateRange
  moduleId?: string
}

// ─── Summary Cards ───────────────────────────────────────

export async function getSummaryStats(params: AnalyticsParams) {
  const { dateRange, moduleId } = params

  const filter = moduleId ? eq(tickets.moduleId, moduleId) : undefined

  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      open: sql<number>`count(*) filter (where ${tickets.status} = 'open')::int`,
      resolved: sql<number>`count(*) filter (where ${tickets.status} = 'resolved')::int`,
      slaBreached: sql<number>`count(*) filter (where ${tickets.slaStatus} = 'breached')::int`,
    })
    .from(tickets)
    .where(
      and(
        gte(tickets.createdAt, dateRange.from),
        lte(tickets.createdAt, dateRange.to),
        ...(filter ? [filter] : []),
      ),
    )
    .execute()

  return row ?? { total: 0, open: 0, resolved: 0, slaBreached: 0 }
}

// ─── Ticket Volume Over Time ─────────────────────────────

export async function getTicketVolume(
  params: AnalyticsParams,
  groupBy: "day" | "week" | "month" = "day",
) {
  const { dateRange, moduleId } = params

  const filter = moduleId ? eq(tickets.moduleId, moduleId) : undefined

  const trunc = groupBy === "day"
    ? sql<string>`to_char(${tickets.createdAt}, 'YYYY-MM-DD')`
    : groupBy === "week"
      ? sql<string>`to_char(date_trunc('week', ${tickets.createdAt}), 'YYYY-MM-DD')`
      : sql<string>`to_char(date_trunc('month', ${tickets.createdAt}), 'YYYY-MM')`

  return db
    .select({
      period: trunc,
      count: sql<number>`count(*)::int`,
    })
    .from(tickets)
    .where(
      and(
        gte(tickets.createdAt, dateRange.from),
        lte(tickets.createdAt, dateRange.to),
        ...(filter ? [filter] : []),
      ),
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`)
    .execute()
}

// ─── Status Distribution ──────────────────────────────────

export async function getStatusDistribution(params: AnalyticsParams) {
  const { dateRange, moduleId } = params
  const filter = moduleId ? eq(tickets.moduleId, moduleId) : undefined

  return db
    .select({
      status: tickets.status,
      count: sql<number>`count(*)::int`,
    })
    .from(tickets)
    .where(
      and(
        gte(tickets.createdAt, dateRange.from),
        lte(tickets.createdAt, dateRange.to),
        ...(filter ? [filter] : []),
      ),
    )
    .groupBy(tickets.status)
    .execute()
}

// ─── Priority Distribution ────────────────────────────────

export async function getPriorityDistribution(params: AnalyticsParams) {
  const { dateRange, moduleId } = params
  const filter = moduleId ? eq(tickets.moduleId, moduleId) : undefined

  return db
    .select({
      priority: tickets.priority,
      count: sql<number>`count(*)::int`,
    })
    .from(tickets)
    .where(
      and(
        gte(tickets.createdAt, dateRange.from),
        lte(tickets.createdAt, dateRange.to),
        ...(filter ? [filter] : []),
      ),
    )
    .groupBy(tickets.priority)
    .execute()
}

// ─── SLA Overview ─────────────────────────────────────────

export async function getSlaOverview(params: AnalyticsParams) {
  const { dateRange, moduleId } = params
  const filter = moduleId ? eq(tickets.moduleId, moduleId) : undefined

  return db
    .select({
      slaStatus: tickets.slaStatus,
      count: sql<number>`count(*)::int`,
    })
    .from(tickets)
    .where(
      and(
        gte(tickets.createdAt, dateRange.from),
        lte(tickets.createdAt, dateRange.to),
        ...(filter ? [filter] : []),
      ),
    )
    .groupBy(tickets.slaStatus)
    .execute()
}

// ─── Module Distribution ──────────────────────────────────

export async function getModuleDistribution(params: AnalyticsParams) {
  const { dateRange } = params

  return db
    .select({
      moduleId: tickets.moduleId,
      moduleName: modules.name,
      moduleColor: modules.color,
      count: sql<number>`count(*)::int`,
    })
    .from(tickets)
    .innerJoin(modules, eq(tickets.moduleId, modules.id))
    .where(
      and(
        gte(tickets.createdAt, dateRange.from),
        lte(tickets.createdAt, dateRange.to),
      ),
    )
    .groupBy(tickets.moduleId, modules.name, modules.color)
    .orderBy(sql`count(*) desc`)
    .execute()
}

// ─── Source Distribution ──────────────────────────────────

export async function getSourceDistribution(params: AnalyticsParams) {
  const { dateRange, moduleId } = params
  const filter = moduleId ? eq(tickets.moduleId, moduleId) : undefined

  return db
    .select({
      source: tickets.source,
      count: sql<number>`count(*)::int`,
    })
    .from(tickets)
    .where(
      and(
        gte(tickets.createdAt, dateRange.from),
        lte(tickets.createdAt, dateRange.to),
        ...(filter ? [filter] : []),
      ),
    )
    .groupBy(tickets.source)
    .execute()
}

// ─── Resolution Breakdown ─────────────────────────────────

export async function getResolutionBreakdown(params: AnalyticsParams) {
  const { dateRange, moduleId } = params
  const filter = moduleId ? eq(tickets.moduleId, moduleId) : undefined

  const [row] = await db
    .select({
      totalResolved: sql<number>`count(*) filter (where ${tickets.status} = 'resolved')::int`,
      resolvedByAi: sql<number>`count(*) filter (where ${tickets.resolvedByType} = 'ai')::int`,
      resolvedByUser: sql<number>`count(*) filter (where ${tickets.resolvedByType} = 'user')::int`,
      avgResolutionMinutes: sql<number | null>`
        round(avg(
          extract(epoch from (${tickets.resolvedAt} - ${tickets.createdAt}))
        ) / 60)::int
      `,
    })
    .from(tickets)
    .where(
      and(
        gte(tickets.createdAt, dateRange.from),
        lte(tickets.createdAt, dateRange.to),
        ...(filter ? [filter] : []),
      ),
    )
    .execute()

  return row ?? { totalResolved: 0, resolvedByAi: 0, resolvedByUser: 0, avgResolutionMinutes: null }
}

// Staff Performance

export async function getStaffPerformance(params: AnalyticsParams) {
  const { dateRange, moduleId } = params
  const filter = moduleId ? eq(tickets.moduleId, moduleId) : undefined

  return db
    .select({
      staffId: users.id,
      staffName: users.name,
      assignedCount: sql<number>`count(*)::int`,
      resolvedCount: sql<number>`count(*) filter (where ${tickets.status} = 'resolved')::int`,
      avgResolutionMinutes: sql<number | null>`
        round(avg(
          extract(epoch from (${tickets.resolvedAt} - ${tickets.createdAt}))
        ) filter (where ${tickets.status} = 'resolved') / 60
        )::int
      `,
    })
    .from(tickets)
    .innerJoin(users, eq(tickets.assigneeId, users.id))
    .where(
      and(
        gte(tickets.createdAt, dateRange.from),
        lte(tickets.createdAt, dateRange.to),
        ...(filter ? [filter] : []),
      ),
    )
    .groupBy(users.id, users.name)
    .orderBy(sql`count(*) desc`)
    .execute()
}

// ─── Root Cause Distribution ──────────────────────────────

export async function getRootCauseDistribution(params: AnalyticsParams) {
  const { dateRange, moduleId } = params
  const filter = moduleId ? eq(tickets.moduleId, moduleId) : undefined

  return db
    .select({
      rootCause: tickets.rootCause,
      count: sql<number>`count(*)::int`,
    })
    .from(tickets)
    .where(
      and(
        gte(tickets.createdAt, dateRange.from),
        lte(tickets.createdAt, dateRange.to),
        ...(filter ? [filter] : []),
      ),
    )
    .groupBy(tickets.rootCause)
    .execute()
}

// ─── Dashboard: Volume trend (created vs resolved per bucket) ──────────────

export async function getVolumeTrend(params: AnalyticsParams, groupBy: Granularity) {
  const { dateRange, moduleId } = params
  const filter = moduleId ? eq(tickets.moduleId, moduleId) : undefined

  const [created, resolved] = await Promise.all([
    db
      .select({ period: bucketCol(tickets.createdAt, groupBy), count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(and(gte(tickets.createdAt, dateRange.from), lte(tickets.createdAt, dateRange.to), ...(filter ? [filter] : [])))
      .groupBy(sql`1`)
      .execute(),
    db
      .select({ period: bucketCol(tickets.resolvedAt, groupBy), count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(
        and(
          isNotNull(tickets.resolvedAt),
          gte(tickets.resolvedAt, dateRange.from),
          lte(tickets.resolvedAt, dateRange.to),
          ...(filter ? [filter] : []),
        ),
      )
      .groupBy(sql`1`)
      .execute(),
  ])

  const byPeriod = new Map<string, { period: string; created: number; resolved: number }>()
  for (const row of created) {
    byPeriod.set(row.period, { period: row.period, created: row.count, resolved: 0 })
  }
  for (const row of resolved) {
    const entry = byPeriod.get(row.period) ?? { period: row.period, created: 0, resolved: 0 }
    entry.resolved = row.count
    byPeriod.set(row.period, entry)
  }
  return Array.from(byPeriod.values()).sort((a, b) => a.period.localeCompare(b.period))
}

// ─── Dashboard: SLA breakdown per priority ────────────────────────────────

export async function getSlaByPriority(params: AnalyticsParams) {
  const { dateRange, moduleId } = params
  const filter = moduleId ? eq(tickets.moduleId, moduleId) : undefined

  return db
    .select({
      priority: tickets.priority,
      safe: sql<number>`count(*) filter (where ${tickets.slaStatus} = 'safe')::int`,
      warning: sql<number>`count(*) filter (where ${tickets.slaStatus} = 'warning')::int`,
      breached: sql<number>`count(*) filter (where ${tickets.slaStatus} = 'breached')::int`,
    })
    .from(tickets)
    .where(and(gte(tickets.createdAt, dateRange.from), lte(tickets.createdAt, dateRange.to), ...(filter ? [filter] : [])))
    .groupBy(tickets.priority)
    .execute()
}

// ─── Dashboard: First-response time trend (minutes per bucket) ─────────────

export async function getResponseTimeTrend(params: AnalyticsParams, groupBy: Granularity) {
  const { dateRange, moduleId } = params
  const filter = moduleId ? eq(tickets.moduleId, moduleId) : undefined

  const rows = await db
    .select({
      period: bucketCol(tickets.createdAt, groupBy),
      avg: sql<number | null>`round(avg(
        extract(epoch from (${tickets.firstRespondedAt} - ${tickets.createdAt})) / 60
      ) filter (where ${tickets.firstRespondedAt} is not null))::int`,
    })
    .from(tickets)
    .where(and(gte(tickets.createdAt, dateRange.from), lte(tickets.createdAt, dateRange.to), ...(filter ? [filter] : [])))
    .groupBy(sql`1`)
    .orderBy(sql`1`)
    .execute()

  return rows.map((r) => ({ period: r.period, avg: r.avg ?? 0 }))
}

// ─── Dashboard: Resolution split (AI / agent / escalated) ──────────────────

export async function getResolutionSplit(params: AnalyticsParams) {
  const { dateRange, moduleId } = params
  const filter = moduleId ? eq(tickets.moduleId, moduleId) : undefined
  const escalated = sql`exists (select 1 from ${ticketEscalations} where ${ticketEscalations.ticketId} = ${tickets.id})`

  const [row] = await db
    .select({
      totalResolved: sql<number>`count(*) filter (where ${tickets.status} = 'resolved')::int`,
      ai: sql<number>`count(*) filter (where ${tickets.status} = 'resolved' and ${tickets.resolvedByType} = 'ai' and not ${escalated})::int`,
      agent: sql<number>`count(*) filter (where ${tickets.status} = 'resolved' and (${tickets.resolvedByType} is distinct from 'ai') and not ${escalated})::int`,
      escalated: sql<number>`count(*) filter (where ${tickets.status} = 'resolved' and ${escalated})::int`,
    })
    .from(tickets)
    .where(and(gte(tickets.createdAt, dateRange.from), lte(tickets.createdAt, dateRange.to), ...(filter ? [filter] : [])))
    .execute()

  return row ?? { totalResolved: 0, ai: 0, agent: 0, escalated: 0 }
}

// ─── Dashboard: Aging backlog (currently-open tickets by age) ──────────────
// Backlog reflects the live open queue, so it is intentionally NOT date-ranged.

export async function getAgingBacklog(moduleId?: string) {
  const filter = moduleId ? eq(tickets.moduleId, moduleId) : undefined
  const age = sql`now() - ${tickets.createdAt}`

  const [row] = await db
    .select({
      under1d: sql<number>`count(*) filter (where ${age} < interval '1 day')::int`,
      d1to3: sql<number>`count(*) filter (where ${age} >= interval '1 day' and ${age} < interval '3 days')::int`,
      d3to7: sql<number>`count(*) filter (where ${age} >= interval '3 days' and ${age} < interval '7 days')::int`,
      over7d: sql<number>`count(*) filter (where ${age} >= interval '7 days')::int`,
    })
    .from(tickets)
    .where(and(sql`${tickets.status} not in ('resolved', 'closed')`, ...(filter ? [filter] : [])))
    .execute()

  return [
    { bucket: "< 1 hari", tickets: row?.under1d ?? 0 },
    { bucket: "1–3 hari", tickets: row?.d1to3 ?? 0 },
    { bucket: "3–7 hari", tickets: row?.d3to7 ?? 0 },
    { bucket: "> 7 hari", tickets: row?.over7d ?? 0 },
  ]
}

// ─── Dashboard: KPI metrics for one period (raw, no deltas) ────────────────

async function getPeriodMetrics(dateRange: DateRange, moduleId?: string) {
  const filter = moduleId ? eq(tickets.moduleId, moduleId) : undefined

  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      unresolved: sql<number>`count(*) filter (where ${tickets.status} not in ('resolved', 'closed'))::int`,
      resolved: sql<number>`count(*) filter (where ${tickets.status} = 'resolved')::int`,
      slaBreached: sql<number>`count(*) filter (where ${tickets.slaStatus} = 'breached')::int`,
      aiResolved: sql<number>`count(*) filter (where ${tickets.status} = 'resolved' and ${tickets.resolvedByType} = 'ai')::int`,
      avgResponse: sql<number | null>`round(avg(
        extract(epoch from (${tickets.firstRespondedAt} - ${tickets.createdAt})) / 60
      ) filter (where ${tickets.firstRespondedAt} is not null))::int`,
    })
    .from(tickets)
    .where(and(gte(tickets.createdAt, dateRange.from), lte(tickets.createdAt, dateRange.to), ...(filter ? [filter] : [])))
    .execute()

  const r = row ?? { total: 0, unresolved: 0, resolved: 0, slaBreached: 0, aiResolved: 0, avgResponse: null }
  const slaCompliance = r.total ? Math.round(((r.total - r.slaBreached) / r.total) * 100) : 0
  const aiDeflection = r.resolved ? Math.round((r.aiResolved / r.resolved) * 100) : 0
  return {
    total: r.total,
    unresolved: r.unresolved,
    resolved: r.resolved,
    avgResponse: r.avgResponse ?? 0,
    slaCompliance,
    aiDeflection,
  }
}

export type DashboardKpi = {
  label: string
  value: string
  delta: number | null
  positiveIsGood: boolean
}

/** Percentage change from `prev` to `cur`; null when there is no prior baseline. */
function pctDelta(cur: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((cur - prev) / prev) * 100)
}

export async function getDashboardKpis(params: AnalyticsParams): Promise<DashboardKpi[]> {
  const { dateRange, moduleId } = params
  const span = dateRange.to.getTime() - dateRange.from.getTime()
  const prevRange: DateRange = {
    from: new Date(dateRange.from.getTime() - span),
    to: dateRange.from,
  }

  const [cur, prev] = await Promise.all([
    getPeriodMetrics(dateRange, moduleId),
    getPeriodMetrics(prevRange, moduleId),
  ])

  return [
    { label: "Total Tiket", value: `${cur.total}`, delta: pctDelta(cur.total, prev.total), positiveIsGood: true },
    { label: "Belum Selesai", value: `${cur.unresolved}`, delta: pctDelta(cur.unresolved, prev.unresolved), positiveIsGood: false },
    { label: "Selesai", value: `${cur.resolved}`, delta: pctDelta(cur.resolved, prev.resolved), positiveIsGood: true },
    { label: "Avg Respons", value: `${cur.avgResponse}m`, delta: pctDelta(cur.avgResponse, prev.avgResponse), positiveIsGood: false },
    { label: "Kepatuhan SLA", value: `${cur.slaCompliance}%`, delta: pctDelta(cur.slaCompliance, prev.slaCompliance), positiveIsGood: true },
    { label: "Defleksi AI", value: `${cur.aiDeflection}%`, delta: pctDelta(cur.aiDeflection, prev.aiDeflection), positiveIsGood: true },
  ]
}
