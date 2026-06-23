import type { DashboardEvent } from "@/lib/dashboard-events.types";

/** Visual treatment for each event type on the wall: a dot color + short tag. */
export interface EventMeta {
  /** Tailwind text/bg color token for the accent dot + tag. */
  accent: string;
  /** Short uppercase tag rendered in the feed/pipeline. */
  tag: string;
}

const META: Record<string, EventMeta> = {
  "ticket.new": { accent: "text-sky-400", tag: "BARU" },
  "requester.firsttime": { accent: "text-emerald-400", tag: "PERTAMA" },
  "vision.captioned": { accent: "text-fuchsia-400", tag: "GAMBAR" },
  "classify.module": { accent: "text-indigo-400", tag: "MODUL" },
  "classify.priority": { accent: "text-amber-400", tag: "PRIORITAS" },
  "guard.offtopic": { accent: "text-rose-400", tag: "GUARD" },
  "kb.searched": { accent: "text-cyan-400", tag: "KB" },
  "kb.matched": { accent: "text-teal-400", tag: "KB ✓" },
  "procedure.picked": { accent: "text-violet-400", tag: "PROSEDUR" },
  "tool.invoked": { accent: "text-orange-400", tag: "TOOL" },
  "tool.result": { accent: "text-orange-300", tag: "TOOL →" },
  "gate.decision": { accent: "text-yellow-400", tag: "GATE" },
  "reply.sent": { accent: "text-emerald-400", tag: "BALAS" },
  "ingestion.progress": { accent: "text-blue-400", tag: "INGEST" },
  "sla.changed": { accent: "text-red-400", tag: "SLA" },
  "ticket.autoclosed": { accent: "text-zinc-400", tag: "TUTUP" },
};

const FALLBACK: EventMeta = { accent: "text-zinc-400", tag: "EVENT" };

export function eventMeta(type: DashboardEvent["type"] | string): EventMeta {
  return META[type] ?? FALLBACK;
}

/** hh:mm:ss for the wall, in id-ID locale. */
export function clockTime(ts: number): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ts));
}
