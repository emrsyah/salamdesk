import "dotenv/config";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * Cross-model latency + structured-output compatibility benchmark for the AI
 * triage pipeline.
 *
 * For each candidate model it runs every generateObject() call the triage
 * pipeline actually makes, with the SAME Zod schemas, and records:
 *   - latency per call type
 *   - whether the model can produce the structured output at all (ok/FAIL)
 *
 * Run: npx tsx scripts/bench-triage-models.ts
 *      MODELS="a,b" BENCH_RUNS=2 npx tsx scripts/bench-triage-models.ts
 */

const or = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
const RUNS = Number(process.env.BENCH_RUNS ?? 2);

const MODELS = (
  process.env.MODELS ??
  [
    "google/gemini-2.5-flash", // current baseline
    "openai/gpt-oss-120b:nitro",
    "z-ai/glm-4.7:nitro",
    "minimax/minimax-m2.7:nitro",
    "qwen/qwen3-32b:nitro",
  ].join(",")
).split(",").map((m) => m.trim()).filter(Boolean);

// --- Sample ticket (Bahasa Indonesia, SIMRS helpdesk) ---
const TITLE = "Tidak bisa input resep di farmasi";
const TEXT =
  "Selamat pagi, saya petugas farmasi. Sejak tadi pagi sistem SIMRS tidak bisa menyimpan resep pasien rawat jalan, muncul error 'gagal menyimpan'. Mohon bantuannya karena antrian sudah panjang.";
const KB_TITLE = "Mengatasi gagal menyimpan resep di modul Farmasi";
const KB_CONTENT =
  "Jika muncul error 'gagal menyimpan' saat input resep, pastikan koneksi jaringan stabil, lalu refresh halaman (Ctrl+F5). Bila masih gagal, periksa apakah stok obat tersedia. Jika tetap error, laporkan ke IT.";
const MODULES = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Farmasi", slug: "farmasi" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Billing", slug: "billing" },
  { id: "33333333-3333-3333-3333-333333333333", name: "Rawat Jalan", slug: "rawat-jalan" },
];

// --- The exact schemas the triage pipeline uses ---
const ModuleSchema = z.object({
  moduleId: z.string().nullable(),
  moduleName: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});
const PrioritySchema = z.object({
  priority: z.enum(["low", "medium", "critical"]),
  reasoning: z.string(),
});
const OnTopicSchema = z.object({ onTopic: z.boolean(), reasoning: z.string() });
const KbSchema = z.object({
  isRelevant: z.boolean(),
  confidence: z.number().min(0).max(1),
  suggestedReply: z.string().nullable(),
});
const ClarifySchema = z.object({ reply: z.string() });

// One representative call per schema, mirroring the pipeline's prompts.
const CALLS: { name: string; schema: z.ZodTypeAny; prompt: string; temperature: number }[] = [
  {
    name: "module",
    schema: ModuleSchema,
    temperature: 0,
    prompt: `Klasifikasi tiket SIMRS ke modul yang tepat.\nModul: ${MODULES.map((m) => `${m.id}=${m.name}`).join(", ")}\nJudul: ${TITLE}\nDeskripsi: ${TEXT}\nKembalikan moduleId/moduleName (null jika tak cocok), confidence 0-1, reasoning.`,
  },
  {
    name: "priority",
    schema: PrioritySchema,
    temperature: 0,
    prompt: `Tentukan prioritas tiket (low/medium/critical) untuk rumah sakit.\nJudul: ${TITLE}\nDeskripsi: ${TEXT}\nBerikan priority dan reasoning singkat.`,
  },
  {
    name: "onTopic",
    schema: OnTopicSchema,
    temperature: 0,
    prompt: `Apakah tiket ini dalam lingkup layanan helpdesk SIMRS?\nJudul: ${TITLE}\nDeskripsi: ${TEXT}\nKembalikan onTopic (boolean) dan reasoning.`,
  },
  {
    name: "kbEval",
    schema: KbSchema,
    temperature: 0,
    prompt: `Tiket: ${TITLE} - ${TEXT}\nArtikel KB: ${KB_TITLE} - ${KB_CONTENT}\nApakah artikel relevan? Jika ya, buat suggestedReply membantu (maks 3 paragraf). Kembalikan isRelevant, confidence 0-1, suggestedReply (atau null).`,
  },
  {
    name: "clarify",
    schema: ClarifySchema,
    temperature: 0.3,
    prompt: `Pelapor menyapa tanpa detail jelas. Balas hangat & ringkas lalu ajukan satu pertanyaan klarifikasi (Bahasa Indonesia). Kembalikan { reply }.`,
  },
];

type CallResult = { ms: number; ok: boolean; err?: string };

async function runCall(model: string, call: (typeof CALLS)[number]): Promise<CallResult> {
  const start = performance.now();
  try {
    const { object } = await generateObject({
      model: or(model),
      schema: call.schema,
      temperature: call.temperature,
      prompt: call.prompt,
    });
    // Validate the shape actually parsed (generateObject already enforces it).
    void object;
    return { ms: performance.now() - start, ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ms: performance.now() - start, ok: false, err: msg.slice(0, 120) };
  }
}

function avg(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

async function main() {
  console.log(`\n=== Triage model benchmark (structured output) ===`);
  console.log(`Runs/call: ${RUNS}   Models: ${MODELS.length}\n`);

  const summary: { model: string; perCall: Record<string, CallResult[]>; e2eOk: boolean }[] = [];

  for (const model of MODELS) {
    console.log(`\n── ${model} ──`);
    const perCall: Record<string, CallResult[]> = {};
    for (const call of CALLS) {
      perCall[call.name] = [];
      for (let i = 0; i < RUNS; i++) {
        const r = await runCall(model, call);
        perCall[call.name].push(r);
      }
      const rs = perCall[call.name];
      const okCount = rs.filter((r) => r.ok).length;
      const okAvg = avg(rs.filter((r) => r.ok).map((r) => r.ms));
      const status = okCount === RUNS ? "ok " : okCount === 0 ? "FAIL" : "part";
      const firstErr = rs.find((r) => !r.ok)?.err;
      console.log(
        `  ${call.name.padEnd(9)} ${status} ${okCount}/${RUNS}  ${Number.isNaN(okAvg) ? "   -  " : okAvg.toFixed(0).padStart(5) + "ms"}` +
          (firstErr ? `   ⚠ ${firstErr}` : ""),
      );
    }
    // Simulated end-to-end = parallel(module, priority, onTopic) + kbEval (sequential after).
    const e2eOk = CALLS.every((c) => perCall[c.name].some((r) => r.ok));
    summary.push({ model, perCall, e2eOk });
  }

  console.log(`\n\n=== SUMMARY: avg latency per call (ms), "FAIL" = no structured output ===\n`);
  const header = ["model", ...CALLS.map((c) => c.name), "e2e~"].map((h) => h.padEnd(11)).join(" ");
  console.log(header);
  console.log("-".repeat(header.length));
  for (const s of summary) {
    const cells = CALLS.map((c) => {
      const rs = s.perCall[c.name];
      const okAvg = avg(rs.filter((r) => r.ok).map((r) => r.ms));
      return Number.isNaN(okAvg) ? "FAIL" : okAvg.toFixed(0);
    });
    // e2e estimate: max(module,priority,onTopic) + kbEval (the pipeline's structure).
    const get = (n: string) => avg(s.perCall[n].filter((r) => r.ok).map((r) => r.ms));
    const parGroup = Math.max(get("module"), get("priority"), get("onTopic"));
    const e2e = s.e2eOk ? (parGroup + get("kbEval")).toFixed(0) : "n/a";
    console.log([s.model, ...cells, e2e].map((x) => String(x).padEnd(11)).join(" "));
  }
  console.log(`\ne2e~ = max(module,priority,onTopic) + kbEval, i.e. the parallelized pipeline shape.`);
  console.log(`Clarify only runs on the AI-first fallback (no KB/procedure match).\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
