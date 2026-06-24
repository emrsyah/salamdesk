/**
 * The single source of truth for the triage pipeline's *shape*: its nodes, the
 * directed edges between them, and their hand-laid positions. Drawn live by the
 * exhibit `TriageGraph` (a monitor) and edited by the Agent Canvas (a config
 * editor) — both import from here so the two views can never disagree about how
 * `triage.service.ts` actually runs.
 *
 * The topology is intentionally fixed (see docs/adr/0001): when the engine's
 * shape changes, update THIS file and both views follow.
 */

export type PipelineNodeId =
  | "intake"
  | "vision"
  | "module"
  | "priority"
  | "guard"
  | "kb"
  | "kbmatch"
  | "procedure"
  | "tools"
  | "gate"
  | "reply";

export interface PipelineNodeDef {
  id: PipelineNodeId;
  icon: string;
  label: string;
  x: number;
  y: number;
  /** Optional stages render faint until actually traversed / enabled. */
  optional?: boolean;
}

export interface PipelineEdgeDef {
  from: PipelineNodeId;
  to: PipelineNodeId;
  optional?: boolean;
}

/** Static topology — positions hand-laid for a clean left-to-right read. */
export const NODE_DEFS: PipelineNodeDef[] = [
  { id: "intake", icon: "💬", label: "Pesan masuk", x: 0, y: 260 },
  { id: "vision", icon: "🖼️", label: "Baca gambar", x: 150, y: 20, optional: true },
  { id: "module", icon: "🎯", label: "Klasifikasi modul", x: 295, y: 110 },
  { id: "priority", icon: "🚦", label: "Nilai prioritas", x: 295, y: 260 },
  { id: "guard", icon: "🛡️", label: "Penjaga topik", x: 295, y: 410 },
  { id: "kb", icon: "🔎", label: "Cari panduan", x: 510, y: 260 },
  { id: "kbmatch", icon: "📖", label: "Susun jawaban", x: 715, y: 110, optional: true },
  { id: "procedure", icon: "🧭", label: "Jalankan prosedur", x: 715, y: 260, optional: true },
  { id: "tools", icon: "⚙️", label: "Panggil alat", x: 715, y: 410, optional: true },
  { id: "gate", icon: "🚪", label: "Gerbang auto-reply", x: 930, y: 260 },
  { id: "reply", icon: "✍️", label: "Balasan", x: 1145, y: 260 },
];

/** Directed edges; `optional` ones render faint until actually traversed. */
export const EDGE_DEFS: PipelineEdgeDef[] = [
  { from: "intake", to: "vision", optional: true },
  { from: "vision", to: "module", optional: true },
  { from: "intake", to: "module" },
  { from: "intake", to: "priority" },
  { from: "intake", to: "guard" },
  { from: "module", to: "kb" },
  { from: "kb", to: "kbmatch" },
  { from: "kb", to: "procedure" },
  { from: "procedure", to: "tools", optional: true },
  { from: "kbmatch", to: "gate" },
  { from: "procedure", to: "gate" },
  { from: "tools", to: "gate", optional: true },
  { from: "priority", to: "gate" },
  { from: "guard", to: "gate" },
  { from: "gate", to: "reply" },
];

/**
 * Which engine node a dashboard event lights up. Used by the exhibit monitor to
 * map a live event stream onto the graph; the config canvas does not need this.
 */
export const NODE_OF: Record<string, PipelineNodeId> = {
  "ticket.new": "intake",
  "requester.firsttime": "intake",
  "vision.captioned": "vision",
  "doc.read": "vision",
  "voice.transcribed": "vision",
  "classify.module": "module",
  "classify.priority": "priority",
  "guard.offtopic": "guard",
  "kb.searched": "kb",
  "kb.matched": "kbmatch",
  "procedure.picked": "procedure",
  "tool.invoked": "tools",
  "tool.result": "tools",
  "gate.decision": "gate",
  "reply.sent": "reply",
};
