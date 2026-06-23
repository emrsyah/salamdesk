/**
 * Pure type definitions for the exhibition live-wall event stream. Kept free of
 * any server-only imports (ioredis, node:crypto) so client components (the wall
 * UI) can import the {@link DashboardEvent} shape without bundling the publisher.
 *
 * The runtime publisher + channel name live in {@link ./dashboard-events.ts}.
 */

/** Reasons an auto-reply can be gated by `canAutoReply`, surfaced for the wall. */
export type GateBypass =
  | "kb-grounding"
  | "confidence"
  | "critical"
  | "per-ticket-cap";

/**
 * Fields every dashboard event shares. `id`/`ts` are stamped by the publisher so
 * call sites only provide the payload. `label` is a short human-readable summary
 * the feed can render with zero formatting.
 */
export interface DashboardEventBase {
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
    | {
        type: "ticket.new";
        requesterName: string | null;
        preview: string;
        channel: string;
        /** True when the message matches the exhibition QR prefill — a booth visitor. */
        boothVisitor?: boolean;
      }
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

/**
 * A dashboard event payload with `id`/`ts` omitted — supplied at publish time.
 * Distributive so `Omit` is applied to each union member individually (a plain
 * `Omit<Union, K>` would collapse to only the members' common keys).
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;
export type DashboardEventInput = DistributiveOmit<DashboardEvent, "id" | "ts">;
