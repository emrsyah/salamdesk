import "dotenv/config";
import { AI_MODEL } from "@/lib/ai";
import {
  classifyModule,
  classifyPriority,
  classifyOnTopic,
  evaluateKbMatch,
} from "@/services/triage-ai.service";
import { embedKnowledgeQuery } from "@/services/knowledge-embedding.service";

/**
 * Latency benchmark for the AI triage pipeline.
 *
 * Times each network round-trip the triage pipeline makes (LLM classifiers +
 * Voyage embedding), exactly as triageTicket() issues them today (sequentially),
 * then shows what the same set of *independent* calls cost when parallelised.
 *
 * Run: npx tsx scripts/bench-triage-latency.ts
 */

const RUNS = Number(process.env.BENCH_RUNS ?? 3);

// Representative inbound WhatsApp ticket (Bahasa Indonesia, SIMRS helpdesk).
const SAMPLE = {
  title: "Tidak bisa input resep di farmasi",
  text: "Selamat pagi, saya petugas farmasi. Sejak tadi pagi sistem SIMRS tidak bisa menyimpan resep pasien rawat jalan, muncul error 'gagal menyimpan'. Mohon bantuannya karena antrian sudah panjang.",
};

const MOCK_MODULES = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Farmasi", slug: "farmasi" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Billing", slug: "billing" },
  { id: "33333333-3333-3333-3333-333333333333", name: "Rawat Jalan", slug: "rawat-jalan" },
  { id: "44444444-4444-4444-4444-444444444444", name: "Laboratorium", slug: "laboratorium" },
  { id: "55555555-5555-5555-5555-555555555555", name: "Rekam Medis", slug: "rekam-medis" },
];

const MOCK_KB = {
  title: "Mengatasi gagal menyimpan resep di modul Farmasi",
  content:
    "Jika muncul error 'gagal menyimpan' saat input resep, pastikan koneksi jaringan stabil, lalu refresh halaman (Ctrl+F5). Bila masih gagal, periksa apakah stok obat tersedia. Jika tetap error, laporkan ke IT dengan menyebutkan nomor RM pasien.",
};

const BEHAVIOR = {
  agentName: "SalamBot",
  persona: "Asisten helpdesk SIMRS yang ramah dan ringkas",
  tone: "ramah",
  language: "id",
  replySignature: "— Tim IT RSUD Karawang",
  guardrails: "Jangan memberi nasihat medis.",
};

type Timing = { label: string; ms: number; ok: boolean; note?: string };

async function time<T>(label: string, fn: () => Promise<T>): Promise<{ ms: number; value: T | null; ok: boolean; note?: string }> {
  const start = performance.now();
  try {
    const value = await fn();
    return { ms: performance.now() - start, value, ok: true };
  } catch (err) {
    return {
      ms: performance.now() - start,
      value: null,
      ok: false,
      note: err instanceof Error ? err.message : String(err),
    };
  }
}

// The four independent calls the pipeline makes before it has any cross-dependency.
// (module + priority + onTopic only need title/text; embedding only needs text.)
const independentCalls = () => ({
  module: () => classifyModule(SAMPLE.title, SAMPLE.text, MOCK_MODULES),
  priority: () => classifyPriority(SAMPLE.title, SAMPLE.text, "medium"),
  onTopic: () => classifyOnTopic(SAMPLE.title, SAMPLE.text, { persona: BEHAVIOR.persona }),
  embed: () => embedKnowledgeQuery(SAMPLE.text),
});

async function runSequential(): Promise<{ timings: Timing[]; total: number }> {
  const c = independentCalls();
  const timings: Timing[] = [];
  const t0 = performance.now();

  const m = await time("classifyModule (LLM)", c.module);
  timings.push({ label: m.note ? `classifyModule (LLM) — ${m.note}` : "classifyModule (LLM)", ms: m.ms, ok: m.ok });

  const p = await time("classifyPriority (LLM)", c.priority);
  timings.push({ label: "classifyPriority (LLM)", ms: p.ms, ok: p.ok, note: p.note });

  const o = await time("classifyOnTopic (LLM)", c.onTopic);
  timings.push({ label: "classifyOnTopic (LLM)", ms: o.ms, ok: o.ok, note: o.note });

  const e = await time("embedKnowledgeQuery (Voyage)", c.embed);
  timings.push({ label: "embedKnowledgeQuery (Voyage)", ms: e.ms, ok: e.ok, note: e.note });

  // evaluateKbMatch depends on the KB row (here mocked) — runs after retrieval.
  const k = await time("evaluateKbMatch (LLM)", () =>
    evaluateKbMatch(SAMPLE.title, SAMPLE.text, MOCK_KB.title, MOCK_KB.content, BEHAVIOR),
  );
  timings.push({ label: "evaluateKbMatch (LLM)", ms: k.ms, ok: k.ok, note: k.note });

  return { timings, total: performance.now() - t0 };
}

async function runParallelizable(): Promise<number> {
  // What the pipeline COULD do: fire the 4 independent calls together, then the
  // KB eval (the one true dependency) afterwards.
  const c = independentCalls();
  const t0 = performance.now();
  await Promise.all([c.module(), c.priority(), c.onTopic(), c.embed()]);
  await evaluateKbMatch(SAMPLE.title, SAMPLE.text, MOCK_KB.title, MOCK_KB.content, BEHAVIOR);
  return performance.now() - t0;
}

function stats(nums: number[]) {
  const sorted = [...nums].sort((a, b) => a - b);
  const sum = nums.reduce((a, b) => a + b, 0);
  return {
    avg: sum / nums.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

async function main() {
  console.log(`\n=== AI Triage Latency Benchmark ===`);
  console.log(`Model:  ${AI_MODEL}`);
  console.log(`Runs:   ${RUNS}`);
  console.log(`Ticket: "${SAMPLE.title}"\n`);

  const seqTotals: number[] = [];
  const parTotals: number[] = [];
  const perCall: Record<string, number[]> = {};

  for (let i = 0; i < RUNS; i++) {
    process.stdout.write(`Run ${i + 1}/${RUNS} ... `);
    const seq = await runSequential();
    seqTotals.push(seq.total);
    for (const t of seq.timings) {
      const key = t.label.split(" —")[0];
      (perCall[key] ??= []).push(t.ms);
      if (!t.ok) console.log(`\n  ⚠ ${t.label} FAILED: ${t.note}`);
    }
    const par = await runParallelizable();
    parTotals.push(par);
    console.log(`seq=${seq.total.toFixed(0)}ms  parallelized=${par.toFixed(0)}ms`);
  }

  console.log(`\n--- Per-call latency (avg over ${RUNS} runs) ---`);
  for (const [label, nums] of Object.entries(perCall)) {
    const s = stats(nums);
    console.log(`  ${label.padEnd(32)} avg ${s.avg.toFixed(0).padStart(5)}ms  (min ${s.min.toFixed(0)} / max ${s.max.toFixed(0)})`);
  }

  const seqS = stats(seqTotals);
  const parS = stats(parTotals);
  console.log(`\n--- End-to-end (5 calls: module+priority+onTopic+embed+kbEval) ---`);
  console.log(`  Sequential (current code):  avg ${seqS.avg.toFixed(0)}ms  (min ${seqS.min.toFixed(0)} / max ${seqS.max.toFixed(0)})`);
  console.log(`  Parallelized (4 indep + 1): avg ${parS.avg.toFixed(0)}ms  (min ${parS.min.toFixed(0)} / max ${parS.max.toFixed(0)})`);
  const saved = seqS.avg - parS.avg;
  console.log(`  Potential saving:           ${saved.toFixed(0)}ms (${((saved / seqS.avg) * 100).toFixed(0)}%)\n`);
  console.log(`Note: this excludes the procedure router + runProcedure LLM calls`);
  console.log(`(tryProcedure), which add 1-2 more sequential round-trips when any`);
  console.log(`procedure is enabled, and the BullMQ queue wait (worker concurrency=3).\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
