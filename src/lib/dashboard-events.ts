import { randomUUID } from "node:crypto";
import { redisConnection } from "./redis";

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

/** Reasons an auto-reply can be gated by `canAutoReply`, surfaced for the wall. */
export type GateBypass =
  | "kb-grounding"
  | "confidence"
  | "critical"
  | "per-ticket-cap";

/**
 * Fields every dashboard event shares. `id`/`ts` are stamped by
 * {@link publishDashboardEvent} so call sites only provide the payload. `label`
 * is a short human-readable summary the feed can render with zero formatting.
 */
interface DashboardEventBase {
  /** Unique per event — used as the React key for enter/exit animations. */
  id: string;
  /** Epoch ms, stamped at publish time. */
  ts: number;
  /** Ticket this event belongs to (null for non-ticket events like ingestion). */
  ticketId: string | null;
  /** Short, ready-to-render summary, e.g. "Modul: Billing (91%)". */
  label: string;
}

/**
 * Discriminated union of everything the live wall can visualise. Each variant
 * carries just enough detail to render its step on its own. Keep additions
 * backward-compatible — the client renders unknown `type`s as a generic feed row.
 */
export type DashboardEvent = DashboardEventBase &
  (
    | { type: "ticket.new"; requesterName: string | null; preview: string; channel: string }
    | { type: "requester.firsttime"; requesterName: string | null }
    | { type: "vision.captioned"; caption: string }
    | {
        type: "classify.module";
        moduleId: string | null;
        moduleName: string | null;
        confidence: number;
        reason: string;
      }
    | {
        type: "classify.priority";
        priority: "low" | "medium" | "critical";
        reason: string;
      }
    | { type: "guard.offtopic"; onTopic: boolean; reason: string }
    | { type: "kb.searched"; query: string; chunksScanned: number; matchCount: number }
    | {
        type: "kb.matched";
        documentId: string | null;
        title: string | null;
        score: number;
        confidence: number;
      }
    | { type: "procedure.picked"; procedureId: string; title: string; confidence: number }
    | {
        type: "tool.invoked";
        tool: string;
        kind: "http" | "exa" | string;
        input: string;
      }
    | { type: "tool.result"; tool: string; ok: boolean; output: string }
    | {
        type: "gate.decision";
        allowed: boolean;
        blockedReason: string | null;
        bypasses: GateBypass[];
      }
    | {
        type: "reply.sent";
        mode: "immediate" | "delayed" | "draft";
        isAiFirst: boolean;
        preview: string;
      }
    | {
        type: "ingestion.progress";
        documentId: string;
        title: string | null;
        stage: "chunking" | "embedding" | "ready" | "failed";
        detail: string;
      }
    | {
        type: "sla.changed";
        kind: "response" | "resolution";
        status: "safe" | "warning" | "breached";
      }
    | { type: "ticket.autoclosed" }
  );

/** A dashboard event payload with `id`/`ts` omitted — supplied at publish time. */
export type DashboardEventInput = Omit<DashboardEvent, "id" | "ts">;

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
    console.error("[dashboard-events] Failed to publish event:", err);
  }
}
