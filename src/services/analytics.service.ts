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

// ─── Dashboard: all single-row aggregates in ONE query ────────────────────
// Collapses status/priority/SLA-by-priority/source/resolution distributions
// plus the current+previous KPI windows into a single round trip. Every metric
// is a conditional aggregate over one scan of the prev_from..to window, which
// matters because each round trip to the (cross-region) pooler is expensive.

export type DashboardScalars = {
  status: NamedCount[]
  priority: NamedCount[]
  slaByPriority: { priority: string; safe: number; warning: number; breached: number }[]
  source: NamedCount[]
  resolution: { ai: number; agent: number; escalated: number }
  kpis: DashboardKpi[]
}

type NamedCount = { key: string; count: number }

export async function getDashboardScalars(params: AnalyticsParams): Promise<DashboardScalars> {
  const { dateRange, moduleId } = params
  const from = dateRange.from
  const to = dateRange.to
  const prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()))
  const moduleFilter = moduleId ? sql` and module_id = ${moduleId}` : sql``

  // Tag each row once (is_cur / is_prev / is_escalated) in a subquery so the
  // date params bind a single time, then aggregate with conditional counts.
  const rows = (await db.execute(sql`
    select
      count(*) filter (where is_cur and status = 'open')::int                                            as st_open,
      count(*) filter (where is_cur and status = 'in_progress')::int                                     as st_in_progress,
      count(*) filter (where is_cur and status = 'waiting')::int                                          as st_waiting,
      count(*) filter (where is_cur and status = 'resolved')::int                                         as st_resolved,
      count(*) filter (where is_cur and status = 'closed')::int                                           as st_closed,
      count(*) filter (where is_cur and priority = 'low')::int                                            as pr_low,
      count(*) filter (where is_cur and priority = 'medium')::int                                         as pr_medium,
      count(*) filter (where is_cur and priority = 'critical')::int                                       as pr_critical,
      count(*) filter (where is_cur and priority = 'critical' and sla_status = 'safe')::int               as sla_crit_safe,
      count(*) filter (where is_cur and priority = 'critical' and sla_status = 'warning')::int            as sla_crit_warn,
      count(*) filter (where is_cur and priority = 'critical' and sla_status = 'breached')::int           as sla_crit_breach,
      count(*) filter (where is_cur and priority = 'medium' and sla_status = 'safe')::int                 as sla_med_safe,
      count(*) filter (where is_cur and priority = 'medium' and sla_status = 'warning')::int              as sla_med_warn,
      count(*) filter (where is_cur and priority = 'medium' and sla_status = 'breached')::int             as sla_med_breach,
      count(*) filter (where is_cur and priority = 'low' and sla_status = 'safe')::int                    as sla_low_safe,
      count(*) filter (where is_cur and priority = 'low' and sla_status = 'warning')::int                 as sla_low_warn,
      count(*) filter (where is_cur and priority = 'low' and sla_status = 'breached')::int                as sla_low_breach,
      count(*) filter (where is_cur and source = 'whatsapp')::int                                         as src_whatsapp,
      count(*) filter (where is_cur and source = 'web')::int                                              as src_web,
      count(*) filter (where is_cur and source = 'email')::int                                            as src_email,
      count(*) filter (where is_cur and source = 'manual')::int                                           as src_manual,
      count(*) filter (where is_cur and source = 'api')::int                                              as src_api,
      count(*) filter (where is_cur and status = 'resolved' and resolved_by_type = 'ai' and not is_esc)::int       as res_ai,
      count(*) filter (where is_cur and status = 'resolved' and resolved_by_type is distinct from 'ai' and not is_esc)::int as res_agent,
      count(*) filter (where is_cur and status = 'resolved' and is_esc)::int                              as res_escalated,
      count(*) filter (where is_cur)::int                                                                 as cur_total,
      count(*) filter (where is_cur and status not in ('resolved', 'closed'))::int                        as cur_unresolved,
      count(*) filter (where is_cur and status = 'resolved')::int                                         as cur_resolved,
      count(*) filter (where is_cur and sla_status = 'breached')::int                                     as cur_breached,
      count(*) filter (where is_cur and status = 'resolved' and resolved_by_type = 'ai')::int             as cur_ai_resolved,
      round(avg(resp_min) filter (where is_cur and resp_min is not null))::int                            as cur_avg_resp,
      count(*) filter (where is_prev)::int                                                                as prev_total,
      count(*) filter (where is_prev and status not in ('resolved', 'closed'))::int                       as prev_unresolved,
      count(*) filter (where is_prev and status = 'resolved')::int                                        as prev_resolved,
      count(*) filter (where is_prev and sla_status = 'breached')::int                                    as prev_breached,
      count(*) filter (where is_prev and status = 'resolved' and resolved_by_type = 'ai')::int            as prev_ai_resolved,
      round(avg(resp_min) filter (where is_prev and resp_min is not null))::int                           as prev_avg_resp
    from (
      select
        status, priority, sla_status, source, resolved_by_type,
        (created_at >= ${from.toISOString()}::timestamptz) as is_cur,
        (created_at >= ${prevFrom.toISOString()}::timestamptz and created_at < ${from.toISOString()}::timestamptz) as is_prev,
        exists (select 1 from ticket_escalations e where e.ticket_id = tickets.id) as is_esc,
        extract(epoch from (first_responded_at - created_at)) / 60 as resp_min
      from tickets
      where created_at >= ${prevFrom.toISOString()}::timestamptz and created_at <= ${to.toISOString()}::timestamptz${moduleFilter}
    ) t
  `)) as unknown as Array<Record<string, number | null>>

  const raw = rows[0] ?? {}
  const n = (k: string) => Number(raw[k] ?? 0)
  const r = {
    stOpen: n("st_open"), stInProgress: n("st_in_progress"), stWaiting: n("st_waiting"),
    stResolved: n("st_resolved"), stClosed: n("st_closed"),
    prLow: n("pr_low"), prMedium: n("pr_medium"), prCritical: n("pr_critical"),
    slaCritSafe: n("sla_crit_safe"), slaCritWarn: n("sla_crit_warn"), slaCritBreach: n("sla_crit_breach"),
    slaMedSafe: n("sla_med_safe"), slaMedWarn: n("sla_med_warn"), slaMedBreach: n("sla_med_breach"),
    slaLowSafe: n("sla_low_safe"), slaLowWarn: n("sla_low_warn"), slaLowBreach: n("sla_low_breach"),
    srcWhatsapp: n("src_whatsapp"), srcWeb: n("src_web"), srcEmail: n("src_email"),
    srcManual: n("src_manual"), srcApi: n("src_api"),
    resAi: n("res_ai"), resAgent: n("res_agent"), resEscalated: n("res_escalated"),
    curTotal: n("cur_total"), curUnresolved: n("cur_unresolved"), curResolved: n("cur_resolved"),
    curBreached: n("cur_breached"), curAiResolved: n("cur_ai_resolved"), curAvgResp: raw["cur_avg_resp"],
    prevTotal: n("prev_total"), prevUnresolved: n("prev_unresolved"), prevResolved: n("prev_resolved"),
    prevBreached: n("prev_breached"), prevAiResolved: n("prev_ai_resolved"), prevAvgResp: raw["prev_avg_resp"],
  }
  const compliance = (total: number, breached: number) =>
    total ? Math.round(((total - breached) / total) * 100) : 0
  const deflection = (resolved: number, ai: number) => (resolved ? Math.round((ai / resolved) * 100) : 0)

  const curAvg = r.curAvgResp ?? 0
  const prevAvg = r.prevAvgResp ?? 0
  const kpis: DashboardKpi[] = [
    { label: "Total Tiket", value: `${r.curTotal}`, delta: pctDelta(r.curTotal, r.prevTotal), positiveIsGood: true },
    { label: "Belum Selesai", value: `${r.curUnresolved}`, delta: pctDelta(r.curUnresolved, r.prevUnresolved), positiveIsGood: false },
    { label: "Selesai", value: `${r.curResolved}`, delta: pctDelta(r.curResolved, r.prevResolved), positiveIsGood: true },
    { label: "Avg Respons", value: `${curAvg}m`, delta: pctDelta(curAvg, prevAvg), positiveIsGood: false },
    { label: "Kepatuhan SLA", value: `${compliance(r.curTotal, r.curBreached)}%`, delta: pctDelta(compliance(r.curTotal, r.curBreached), compliance(r.prevTotal, r.prevBreached)), positiveIsGood: true },
    { label: "Defleksi AI", value: `${deflection(r.curResolved, r.curAiResolved)}%`, delta: pctDelta(deflection(r.curResolved, r.curAiResolved), deflection(r.prevResolved, r.prevAiResolved)), positiveIsGood: true },
  ]

  return {
    status: [
      { key: "open", count: r.stOpen },
      { key: "in_progress", count: r.stInProgress },
      { key: "waiting", count: r.stWaiting },
      { key: "resolved", count: r.stResolved },
      { key: "closed", count: r.stClosed },
    ].filter((s) => s.count > 0),
    priority: [
      { key: "low", count: r.prLow },
      { key: "medium", count: r.prMedium },
      { key: "critical", count: r.prCritical },
    ].filter((p) => p.count > 0),
    slaByPriority: [
      { priority: "critical", safe: r.slaCritSafe, warning: r.slaCritWarn, breached: r.slaCritBreach },
      { priority: "medium", safe: r.slaMedSafe, warning: r.slaMedWarn, breached: r.slaMedBreach },
      { priority: "low", safe: r.slaLowSafe, warning: r.slaLowWarn, breached: r.slaLowBreach },
    ],
    source: [
      { key: "whatsapp", count: r.srcWhatsapp },
      { key: "web", count: r.srcWeb },
      { key: "email", count: r.srcEmail },
      { key: "manual", count: r.srcManual },
      { key: "api", count: r.srcApi },
    ].filter((s) => s.count > 0),
    resolution: { ai: r.resAi, agent: r.resAgent, escalated: r.resEscalated },
    kpis,
  }
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
