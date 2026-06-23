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

/** Humane elapsed time, e.g. 4200 → "4,2 dtk", 850 → "0,9 dtk". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const seconds = ms / 1000;
  return `${seconds.toFixed(1).replace(".", ",")} dtk`;
}
