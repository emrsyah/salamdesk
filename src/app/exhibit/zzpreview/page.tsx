"use client";

// TEMPORARY visual check for the stacked (top-N) compact graph layout.
// Mimics 3 lanes at realistic column height. Delete after screenshotting.

import type { PipelineState } from "@/app/exhibit/exhibit-stream-context";
import type { DashboardEvent } from "@/lib/dashboard-events.types";
import { TriageGraph } from "@/components/exhibit/pipeline-graph";

let n = 0;
function ev(p: { type: DashboardEvent["type"]; label: string } & Record<string, unknown>): DashboardEvent {
  n += 1;
  return { id: `e${n}`, ts: 1000 + n * 600, ticketId: "t", ...p } as DashboardEvent;
}

const A: PipelineState = {
  ticketId: "a", requesterName: "Budi", preview: "Printer SEP error E-205",
  lastTs: 5000, done: false, boothVisitor: true,
  steps: [
    ev({ type: "ticket.new", label: "Pesan masuk" }),
    ev({ type: "classify.module", label: "Modul: Billing (91%)", confidence: 0.91 }),
    ev({ type: "classify.priority", label: "Prioritas: critical", priority: "critical" }),
    ev({ type: "guard.offtopic", label: "Dalam topik SIMRS", onTopic: true }),
    ev({ type: "kb.searched", label: "Cari KB: 3 kandidat" }),
  ],
};
const B: PipelineState = {
  ticketId: "b", requesterName: "Sari", preview: "Mau bayar tiket",
  lastTs: 9000, done: true, boothVisitor: false,
  steps: [
    ev({ type: "ticket.new", label: "Pesan masuk" }),
    ev({ type: "classify.module", label: "Modul: Billing (88%)", confidence: 0.88 }),
    ev({ type: "classify.priority", label: "Prioritas: low", priority: "low" }),
    ev({ type: "guard.offtopic", label: "Dalam topik", onTopic: true }),
    ev({ type: "kb.searched", label: "Cari KB: 2 kandidat" }),
    ev({ type: "kb.matched", label: "KB cocok: Reset Printer (88%)", confidence: 0.88, title: "Reset Printer" }),
    ev({ type: "gate.decision", label: "Lolos gate", allowed: true }),
    ev({ type: "reply.sent", label: "Balasan terkirim", mode: "immediate", preview: "x" }),
  ],
};
const C: PipelineState = {
  ticketId: "c", requesterName: "Anon", preview: "resep masakan padang",
  lastTs: 4000, done: true, boothVisitor: false,
  steps: [
    ev({ type: "ticket.new", label: "Pesan masuk" }),
    ev({ type: "classify.module", label: "Modul: belum ditentukan", confidence: 0.2 }),
    ev({ type: "classify.priority", label: "Prioritas: low", priority: "low" }),
    ev({ type: "guard.offtopic", label: "Di luar topik — ditahan", onTopic: false }),
    ev({ type: "gate.decision", label: "Ditahan: di luar topik", allowed: false }),
    ev({ type: "reply.sent", label: "Disiapkan sebagai draf", mode: "draft", preview: "x" }),
  ],
};

export default function Preview() {
  return (
    <div className="h-screen bg-zinc-50 p-4">
      <div className="mx-auto flex h-full max-w-[760px] flex-col gap-3">
        {[A, B, C].map((p) => (
          <div key={p.ticketId} className="min-h-[190px] flex-1 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <TriageGraph pipeline={p} compact />
          </div>
        ))}
      </div>
    </div>
  );
}
