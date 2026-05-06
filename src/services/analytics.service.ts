import { db } from "@/db"
import { tickets } from "@/db/schema/tickets"
import { modules } from "@/db/schema/modules"
import { users } from "@/db/schema/users"
import { sql, eq, and, gte, lte } from "drizzle-orm"

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

// ─── Agent Performance ────────────────────────────────────

export async function getAgentPerformance(params: AnalyticsParams) {
  const { dateRange, moduleId } = params
  const filter = moduleId ? eq(tickets.moduleId, moduleId) : undefined

  return db
    .select({
      agentId: users.id,
      agentName: users.name,
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
