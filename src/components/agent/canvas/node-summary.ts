import type { AiConfig } from "@/services/ai-config.service";
import type { PipelineNodeId } from "@/lib/agent/pipeline-topology";

/**
 * The read-side mirror of each stage node's config ownership: given the current
 * config, return the small "value badges" a node shows so the canvas is readable
 * without opening any drawer. In Phase 3 the editable drawers will own the same
 * fields — keep the two in lockstep.
 *
 * A badge is `{ text, tone }`. `muted` reads as "off / inactive", `bypassed` as
 * "overridden by AI-first", `normal` as a plain active value.
 */
export type BadgeTone = "normal" | "muted" | "bypassed";
export interface NodeBadge {
  text: string;
  tone: BadgeTone;
}

const onOff = (on: boolean, label: string): NodeBadge => ({
  text: on ? `${label} on` : `${label} off`,
  tone: on ? "normal" : "muted",
});

/** Format a 0–1 threshold compactly, e.g. 0.5 → "amb 0.5". */
const amb = (v: number): NodeBadge => ({ text: `amb ${v}`, tone: "normal" });

export function nodeConfigSummary(id: PipelineNodeId, c: AiConfig): NodeBadge[] {
  switch (id) {
    case "module":
      return c.autoClassifyModule
        ? [onOff(true, "modul"), amb(c.moduleConfidenceThreshold)]
        : [onOff(false, "modul")];
    case "priority":
      return [onOff(c.autoSetPriority, "prioritas")];
    case "guard":
      return [
        c.aiFirstMode && c.offTopicGuardEnabled
          ? { text: "dilewati AI-first", tone: "bypassed" }
          : onOff(c.offTopicGuardEnabled, "penjaga"),
      ];
    case "kb":
      return [onOff(c.kbCrossModuleSearch, "lintas modul")];
    case "procedure":
      return c.proceduresEnabled
        ? [onOff(true, "prosedur"), amb(c.procedureConfidenceThreshold)]
        : [onOff(false, "prosedur")];
    case "gate": {
      if (!c.autoReplyEnabled) return [onOff(false, "auto-reply")];
      const badges: NodeBadge[] = [onOff(true, "auto-reply")];
      badges.push(
        c.aiFirstMode
          ? { text: "amb dilewati", tone: "bypassed" }
          : amb(c.replyConfidenceThreshold),
      );
      badges.push({
        text: c.autoReplyDelayMinutes > 0 ? `tunda ${c.autoReplyDelayMinutes}m` : "langsung",
        tone: "normal",
      });
      badges.push({
        text: `${c.autoReplyChannels.length} kanal`,
        tone: c.autoReplyChannels.length ? "normal" : "muted",
      });
      return badges;
    }
    case "reply":
      return [
        { text: c.agentName || "Asisten", tone: "normal" },
        { text: c.language || "id", tone: "normal" },
      ];
    // intake / vision / kbmatch / tools have no ai-config of their own — label only.
    default:
      return [];
  }
}
