import { listTools } from "./agent-tools.service";
import { getAllKbArticles } from "./knowledge.service";
import type { MentionKind } from "@/lib/agent/procedure-content";

export type MentionSource = { kind: MentionKind; refId: string | null; label: string; hint?: string };

/**
 * All choices the editor's `/` menu can insert, grouped by kind.
 * - tool: enabled agent_tools (refId = tool id)
 * - kb:   KB articles (refId = article id) — only id/title are surfaced, never the body
 * - module / time: single contextual tokens resolved at runtime (refId null)
 */
export async function getMentionSources(): Promise<MentionSource[]> {
  const [tools, kbs] = await Promise.all([listTools(), getAllKbArticles()]);
  const out: MentionSource[] = [];
  for (const t of tools) {
    if (t.enabled) out.push({ kind: "tool", refId: t.id, label: t.name, hint: t.description });
  }
  for (const a of kbs) out.push({ kind: "kb", refId: a.id, label: a.title });
  out.push({ kind: "module", refId: null, label: "Modul tiket", hint: "Modul/kategori tiket saat runtime" });
  out.push({ kind: "time", refId: null, label: "Waktu sekarang", hint: "Tanggal & jam saat eksekusi" });
  return out;
}
