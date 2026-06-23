import type { DashboardEvent } from "@/lib/dashboard-events.types";

/** Visual treatment for each event type on the wall: a dot color + short tag. */
export interface EventMeta {
  /** Tailwind text/bg color token for the accent dot + tag. */
  accent: string;
  /** Short uppercase tag rendered in the feed/pipeline. */
  tag: string;
}

// Functional palette per DESIGN.md: sky=new/search, violet=in-progress,
// orange=priority, red=guard, emerald=found/resolved, amber=AI/tool, slate=closed.
// Rendered at 600 weight for contrast on the white canvas.
const META: Record<string, EventMeta> = {
  "ticket.new": { accent: "text-sky-600", tag: "BARU" },
  "requester.firsttime": { accent: "text-emerald-600", tag: "PERTAMA" },
  "vision.captioned": { accent: "text-violet-600", tag: "GAMBAR" },
  "classify.module": { accent: "text-violet-600", tag: "MODUL" },
  "classify.priority": { accent: "text-orange-600", tag: "PRIORITAS" },
  "guard.offtopic": { accent: "text-red-600", tag: "GUARD" },
  "kb.searched": { accent: "text-sky-600", tag: "KB" },
  "kb.matched": { accent: "text-emerald-600", tag: "KB ✓" },
  "procedure.picked": { accent: "text-violet-600", tag: "PROSEDUR" },
  "tool.invoked": { accent: "text-amber-600", tag: "TOOL" },
  "tool.result": { accent: "text-amber-600", tag: "TOOL →" },
  "gate.decision": { accent: "text-yellow-600", tag: "GATE" },
  "reply.sent": { accent: "text-emerald-600", tag: "BALAS" },
  "ingestion.progress": { accent: "text-sky-600", tag: "INGEST" },
  "sla.changed": { accent: "text-red-600", tag: "SLA" },
  "ticket.autoclosed": { accent: "text-slate-500", tag: "TUTUP" },
};

const FALLBACK: EventMeta = { accent: "text-zinc-500", tag: "EVENT" };

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

/**
 * Plain-language stage for each event, for audiences who don't speak in
 * `classify.module`. An icon + a short human Bahasa phrase so a passer-by can
 * read the wall at a glance.
 */
export interface StepMeta {
  icon: string;
  title: string;
}

const STEP_META: Record<string, StepMeta> = {
  "ticket.new": { icon: "💬", title: "Pesan masuk" },
  "requester.firsttime": { icon: "✨", title: "Pelanggan baru" },
  "vision.captioned": { icon: "🖼️", title: "Membaca gambar" },
  "classify.module": { icon: "🎯", title: "Memahami masalah" },
  "classify.priority": { icon: "🚦", title: "Menilai prioritas" },
  "guard.offtopic": { icon: "🛡️", title: "Memeriksa topik" },
  "kb.searched": { icon: "🔎", title: "Mencari di panduan" },
  "kb.matched": { icon: "📖", title: "Menemukan jawaban" },
  "procedure.picked": { icon: "🧭", title: "Memilih prosedur" },
  "tool.invoked": { icon: "⚙️", title: "Menjalankan alat" },
  "tool.result": { icon: "⚙️", title: "Hasil alat" },
  "gate.decision": { icon: "✅", title: "Memeriksa keamanan" },
  "reply.sent": { icon: "✍️", title: "Mengirim jawaban" },
};

const STEP_FALLBACK: StepMeta = { icon: "•", title: "Memproses" };

export function stepMeta(type: DashboardEvent["type"] | string): StepMeta {
  return STEP_META[type] ?? STEP_FALLBACK;
}

/**
 * The agent's reasoning collapses into four human-readable phases — the journey
 * the wall promises ("Membaca → Memahami → Mencari → Menjawab"). Each raw event
 * type belongs to exactly one phase, so a card can light up its progress rail.
 */
export interface Phase {
  key: string;
  label: string;
  icon: string;
}

export const PHASES: Phase[] = [
  { key: "read", label: "Membaca", icon: "👁️" },
  { key: "understand", label: "Memahami", icon: "🎯" },
  { key: "search", label: "Mencari", icon: "🔎" },
  { key: "answer", label: "Menjawab", icon: "✍️" },
];

const PHASE_INDEX: Record<string, number> = {
  "ticket.new": 0,
  "requester.firsttime": 0,
  "vision.captioned": 0,
  "ingestion.progress": 0,
  "classify.module": 1,
  "classify.priority": 1,
  "guard.offtopic": 1,
  "kb.searched": 2,
  "kb.matched": 2,
  "procedure.picked": 2,
  "tool.invoked": 2,
  "tool.result": 2,
  "gate.decision": 3,
  "reply.sent": 3,
};

/** Which of the four phases an event belongs to (0–3). Defaults to phase 0. */
export function phaseIndex(type: DashboardEvent["type"] | string): number {
  return PHASE_INDEX[type] ?? 0;
}

/** Humane elapsed time, e.g. 4200 → "4,2 dtk", 850 → "0,9 dtk". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const seconds = ms / 1000;
  return `${seconds.toFixed(1).replace(".", ",")} dtk`;
}
