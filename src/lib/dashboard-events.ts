import { randomUUID } from "node:crypto";
import { redisConnection } from "./redis";
import type { DashboardEvent, DashboardEventInput } from "./dashboard-events.types";
import { log } from "@/lib/logger";

const xlog = log("dashboard-events");

// Re-export the shapes so existing `@/lib/dashboard-events` imports keep working.
// Client components should import from `./dashboard-events.types` directly to
// avoid bundling this module's server-only deps (ioredis, node:crypto).
export type {
  DashboardEvent,
  DashboardEventInput,
  DashboardEventBase,
  GateBypass,
} from "./dashboard-events.types";

/**
 * Redis pub/sub channel that carries rich, self-contained AI-activity events to
 * the exhibition "live wall" (`/exhibit`).
 *
 * This is deliberately SEPARATE from {@link ./realtime.ts}'s `ticket-events`
 * channel: that one carries thin notifications and drives the operator app's SWR
 * revalidation, whereas these events are fat (they carry every detail the wall
 * needs to render a step instantly, without a follow-up fetch). The pipeline
 * already records all of this to the `triage_events` table — here we also stream
 * it live so an audience can watch the agent think.
 *
 * Producers (worker process + Next.js server) publish via
 * {@link publishDashboardEvent}; the SSE route at `/api/exhibit/stream`
 * subscribes and forwards each event to connected screens.
 */
export const DASHBOARD_EVENTS_CHANNEL = "dashboard-events";

/**
 * Fire-and-forget publish. The live wall is a best-effort enhancement layered on
 * top of the authoritative `triage_events` audit log, so a Redis hiccup must
 * never break triage — we stamp `id`/`ts`, log on failure, and swallow.
 */
export async function publishDashboardEvent(
  event: DashboardEventInput,
): Promise<void> {
  try {
    const full: DashboardEvent = {
      ...event,
      id: randomUUID(),
      ts: Date.now(),
    } as DashboardEvent;
    await redisConnection.publish(DASHBOARD_EVENTS_CHANNEL, JSON.stringify(full));
  } catch (err) {
    xlog.error({ err }, "failed to publish event");
  }
}
