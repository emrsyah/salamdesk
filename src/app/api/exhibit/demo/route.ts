import { randomUUID } from "node:crypto";
import { publishDashboardEvent } from "@/lib/dashboard-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST /api/exhibit/demo — publish one scripted, realistic ticket flow to the
 * live wall. Lets booth staff keep the wall lively during quiet moments without
 * a real WhatsApp message. Gated by `EXHIBIT_TOKEN` (when set) like the stream.
 *
 * Note: the demo ticket id is synthetic and isn't persisted, so its pipeline
 * card's inspect link won't resolve — that's expected for a demo.
 */
export async function POST(request: Request) {
  const expectedToken = process.env.EXHIBIT_TOKEN;
  if (expectedToken) {
    const token = new URL(request.url).searchParams.get("token");
    if (token !== expectedToken) return new Response("Unauthorized", { status: 401 });
  }

  const ticketId = `demo-${randomUUID()}`;

  await publishDashboardEvent({
    type: "ticket.new",
    ticketId,
    label: "👋 Pengunjung booth: Demo",
    requesterName: "Pengunjung Demo",
    preview: "Printer SEP error saat cetak, muncul kode E-205",
    channel: "whatsapp",
    boothVisitor: true,
  });
  await sleep(700);

  await publishDashboardEvent({
    type: "classify.module",
    ticketId,
    label: "Modul: Billing (91%)",
    moduleId: "demo-module",
    moduleName: "Billing",
    confidence: 0.91,
    reason: "Menyebut SEP & cetak — terkait modul billing.",
  });
  await sleep(500);

  await publishDashboardEvent({
    type: "classify.priority",
    ticketId,
    label: "Prioritas: critical",
    priority: "critical",
    reason: "Berdampak ke pelayanan pasien (cetak SEP terhenti).",
  });
  await sleep(500);

  await publishDashboardEvent({
    type: "guard.offtopic",
    ticketId,
    label: "Dalam topik SIMRS",
    onTopic: true,
    reason: "Pertanyaan teknis SIMRS yang valid.",
  });
  await sleep(500);

  await publishDashboardEvent({
    type: "kb.searched",
    ticketId,
    label: "Cari KB: 3 kandidat",
    query: "printer sep error e-205",
    chunksScanned: 3,
    matchCount: 3,
  });
  await sleep(600);

  await publishDashboardEvent({
    type: "kb.matched",
    ticketId,
    label: "KB cocok: Reset Printer SEP (88%)",
    documentId: "demo-kb",
    title: "Reset Printer SEP",
    score: 0.88,
    confidence: 0.88,
  });
  await sleep(600);

  await publishDashboardEvent({
    type: "gate.decision",
    ticketId,
    label: "Lolos gate auto-reply",
    allowed: true,
    blockedReason: null,
    bypasses: [],
  });
  await sleep(400);

  await publishDashboardEvent({
    type: "reply.sent",
    ticketId,
    label: "Balasan AI terkirim",
    mode: "immediate",
    isAiFirst: false,
    preview:
      "Untuk error E-205, mohon matikan printer SEP 10 detik lalu nyalakan kembali…",
  });

  return Response.json({ ok: true, ticketId });
}
