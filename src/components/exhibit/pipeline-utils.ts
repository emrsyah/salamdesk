import type { PipelineState } from "@/app/exhibit/exhibit-stream-context";
import type { DashboardEvent } from "@/lib/dashboard-events.types";

/** Pull the human-facing payoff out of a finished pipeline's event stream. */
export function pipelineSummary(pipeline: PipelineState) {
  const reply = pipeline.steps.find((s) => s.type === "reply.sent");
  const kb = pipeline.steps.find((s) => s.type === "kb.matched");
  const firstTs = pipeline.steps[0]?.ts;
  const lastTs = reply?.ts;
  return {
    replyPreview: reply && reply.type === "reply.sent" ? reply.preview : null,
    isDraft: reply && reply.type === "reply.sent" ? reply.mode === "draft" : false,
    kbTitle: kb && kb.type === "kb.matched" ? kb.title : null,
    latencyMs: firstTs != null && lastTs != null ? Math.max(0, lastTs - firstTs) : null,
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
