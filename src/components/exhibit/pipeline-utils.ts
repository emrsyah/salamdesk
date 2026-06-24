import type { PipelineState } from "@/app/exhibit/exhibit-stream-context";
import type { DashboardEvent } from "@/lib/dashboard-events.types";

/**
 * The latest event of a given type, by timestamp. Triage publishes dashboard
 * events fire-and-forget, so they can arrive out of array order — we always
 * reason by `ts`, never by position.
 */
export function latestByTs(
  pipeline: PipelineState,
  type: DashboardEvent["type"],
): DashboardEvent | null {
  let found: DashboardEvent | null = null;
  for (const s of pipeline.steps) {
    if (s.type === type && (found == null || s.ts > found.ts)) found = s;
  }
  return found;
}

/** Timestamp of the most recent `reply.sent`, or -Infinity if none yet. */
export function lastReplyTs(pipeline: PipelineState): number {
  let ts = -Infinity;
  for (const s of pipeline.steps) {
    if (s.type === "reply.sent" && s.ts > ts) ts = s.ts;
  }
  return ts;
}

/**
 * Pull the human-facing payoff out of a pipeline's event stream — always the
 * **latest** answer, not the first. Triage re-runs on every follow-up message,
 * so a ticket can carry several `reply.sent` events; the wall must reflect the
 * most recent one, and time it against that run (not the very first event).
 */
export function pipelineSummary(pipeline: PipelineState) {
  const reply = latestByTs(pipeline, "reply.sent");
  const kb = latestByTs(pipeline, "kb.matched");

  // Latency of the latest run: from the earliest event of *this* run (the first
  // step at-or-after the previous reply) to this reply.
  let runStartTs: number | undefined;
  if (reply) {
    let prevReplyTs = -Infinity;
    for (const s of pipeline.steps) {
      if (s.type === "reply.sent" && s.ts < reply.ts && s.ts > prevReplyTs) {
        prevReplyTs = s.ts;
      }
    }
    for (const s of pipeline.steps) {
      if (s.ts > prevReplyTs && s.ts <= reply.ts) {
        if (runStartTs == null || s.ts < runStartTs) runStartTs = s.ts;
      }
    }
  }

  return {
    replyPreview: reply && reply.type === "reply.sent" ? reply.preview : null,
    isDraft: reply && reply.type === "reply.sent" ? reply.mode === "draft" : false,
    kbTitle: kb && kb.type === "kb.matched" ? kb.title : null,
    latencyMs:
      runStartTs != null && reply != null ? Math.max(0, reply.ts - runStartTs) : null,
  };
}

/**
 * Live status signals for a ticket, derived robustly from its (possibly
 * out-of-order) event stream: the module it landed in, its priority, whether
 * the engine is still working, and whether it has answered.
 */
export function ticketSignals(pipeline: PipelineState): {
  moduleName: string | null;
  priority: "low" | "medium" | "critical" | null;
  running: boolean;
  replied: boolean;
} {
  const replyTs = lastReplyTs(pipeline);
  const moduleEv = latestByTs(pipeline, "classify.module");
  const priorityEv = latestByTs(pipeline, "classify.priority");

  // Still working if any non-terminal event is newer than the last reply — this
  // also covers "no reply yet" (replyTs is -Infinity) and follow-up re-runs.
  let running = false;
  for (const s of pipeline.steps) {
    if (s.ts > replyTs && s.type !== "reply.sent") {
      running = true;
      break;
    }
  }

  return {
    moduleName: moduleEv?.type === "classify.module" ? moduleEv.moduleName : null,
    priority: priorityEv?.type === "classify.priority" ? priorityEv.priority : null,
    running,
    replied: replyTs > -Infinity,
  };
}

/** Pull a confidence value out of the events that carry one. */
export function stepConfidence(e: DashboardEvent): number | null {
  switch (e.type) {
    case "classify.module":
    case "kb.matched":
    case "procedure.picked":
      return e.confidence;
    default:
      return null;
  }
}

/**
 * The AI's own reasoning for a step — the "why" behind a decision — pulled from
 * the events that carry it. This is what turns a node from a status light into a
 * glass box: the audience sees *why* it chose a module, flagged a topic, or held
 * a reply at the gate. Returns null for steps that don't reason out loud.
 */
export function stepReason(e: DashboardEvent): string | null {
  switch (e.type) {
    case "classify.module":
    case "classify.priority":
    case "guard.offtopic":
      return e.reason?.trim() || null;
    case "gate.decision":
      // Only the *block* carries a story worth telling; an allowed gate is silent.
      return e.allowed ? null : e.blockedReason?.trim() || null;
    default:
      return null;
  }
}
