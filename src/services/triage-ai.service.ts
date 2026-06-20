import { generateObject, generateText, type ModelMessage } from "ai";
import { z } from "zod";
import { getAiModel, aiTelemetry } from "@/lib/ai";
import { withTrailingUser, type Img } from "@/services/conversation-context.service";
import type { ProcedureBehavior } from "@/services/procedure-execution.service";

/**
 * Vision pre-pass: turn one or more inbound images into a short factual
 * Indonesian description. Used to give the text-only KB retrieval and
 * classifiers something to work with when a requester sends a screenshot with
 * little or no caption. The reply generators see the image directly (via the
 * conversation messages), so this is only for the text-keyed steps.
 */
export async function describeImages(images: Img[], contextText?: string): Promise<string> {
  if (images.length === 0) return "";

  const { text } = await generateText({
    model: getAiModel(),
    experimental_telemetry: aiTelemetry("describe-image", { count: images.length }),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Pengguna mengirim gambar ke helpdesk SIMRS RSUD Karawang${
              contextText ? ` dengan keterangan: "${contextText}"` : ""
            }. Deskripsikan isi gambar secara RINGKAS dan FAKTUAL dalam Bahasa Indonesia (1–2 kalimat), fokus pada hal yang relevan untuk dukungan teknis: pesan error, nama menu/modul, angka, atau kondisi layar. Jangan menebak hal yang tidak terlihat.`,
          },
          ...images.map((img) => ({
            type: "file" as const,
            mediaType: img.mediaType,
            // Prefer inline bytes (fetched by buildTicketConversation); fall back
            // to the URL only if the fetch failed.
            data: img.data ?? new URL(img.url),
          })),
        ],
      },
    ],
  });

  return text.trim();
}

/**
 * Build the voice/behaviour preamble shared with the procedure runtime, so KB
 * auto-replies honour the same configured agent name, persona, tone, language,
 * and guardrails. Returns "" when no behaviour is configured.
 */
function behaviorPreamble(behavior?: ProcedureBehavior): string {
  if (!behavior) return "";
  return [
    `Kamu adalah ${behavior.agentName || "asisten AI"}, agen helpdesk SIMRS RSUD Karawang.`,
    behavior.persona ? `Peran/persona: ${behavior.persona}` : "",
    behavior.tone ? `Nada bicara: ${behavior.tone}` : "",
    `Bahasa balasan: ${behavior.language || "id"}.`,
    behavior.guardrails ? `Batasan WAJIB: ${behavior.guardrails}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const ModuleClassificationSchema = z.object({
  moduleId: z.string().nullable().describe("The UUID of the best matching module, or null if none fits."),
  moduleName: z.string().nullable().describe("The name of the best matching module."),
  confidence: z.number().min(0).max(1).describe("Confidence score from 0.0 to 1.0."),
  reasoning: z.string().describe("Brief explanation of why this module was chosen."),
});

const PriorityClassificationSchema = z.object({
  priority: z.enum(["low", "medium", "critical"]).describe("Ticket urgency level."),
  reasoning: z.string().describe("Brief explanation of urgency assessment."),
});

const KbRelevanceSchema = z.object({
  isRelevant: z.boolean().describe("Whether the KB article actually answers the ticket's question."),
  confidence: z.number().min(0).max(1).describe("How confident the AI is that this article helps."),
  suggestedReply: z
    .string()
    .nullable()
    .describe("A helpful reply to send to the requester in Indonesian, or null if not relevant."),
});

export type ModuleClassification = z.infer<typeof ModuleClassificationSchema>;
export type PriorityClassification = z.infer<typeof PriorityClassificationSchema>;
export type KbRelevance = z.infer<typeof KbRelevanceSchema>;

const OnTopicSchema = z.object({
  onTopic: z.boolean().describe("True jika tiket masih dalam lingkup layanan helpdesk; false jika di luar topik."),
  reasoning: z.string().describe("Alasan singkat dalam Bahasa Indonesia."),
});
export type OnTopicResult = z.infer<typeof OnTopicSchema>;

/**
 * Scope guard: decide whether a ticket is within the agent's support domain
 * (SIMRS / hospital IT helpdesk), so clearly off-topic messages (chit-chat,
 * spam, unrelated requests) are never auto-answered. Uses the configured
 * persona/guardrails as extra scope context when provided.
 */
export async function classifyOnTopic(
  title: string,
  description: string | null,
  scope?: { persona?: string; guardrails?: string },
): Promise<OnTopicResult> {
  const scopeHints = [
    scope?.persona ? `Persona agen: ${scope.persona}` : "",
    scope?.guardrails ? `Batasan: ${scope.guardrails}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { object } = await generateObject({
    model: getAiModel(),
    schema: OnTopicSchema,
    temperature: 0,
    experimental_telemetry: aiTelemetry("classify-on-topic"),
    prompt: `Kamu adalah penjaga lingkup (scope guard) untuk agen AI helpdesk SIMRS RSUD Karawang.
Lingkup layanan: dukungan teknis & operasional sistem rumah sakit (SIMRS) — modul pendaftaran, rawat jalan/inap, farmasi, lab, radiologi, billing/BPJS, rekam medis, antrian, akun/login, error aplikasi, dan pertanyaan terkait penggunaan sistem.
${scopeHints}

Tiket masuk:
Judul: ${title}
Deskripsi: ${description ?? "(tidak ada deskripsi)"}

Tentukan apakah tiket ini MASIH dalam lingkup layanan di atas.
- onTopic = true jika berkaitan (meski tidak yakin modulnya), termasuk sapaan pembuka yang menuju ke masalah SIMRS.
- onTopic = false HANYA jika jelas di luar topik (mis. obrolan pribadi, spam, iklan, pertanyaan umum tak terkait rumah sakit/SIMRS, permintaan membuat konten kreatif).`,
  });

  return object;
}

const ClarifyingReplySchema = z.object({
  reply: z.string().describe("Balasan singkat & ramah dalam Bahasa Indonesia yang menanyakan detail lebih lanjut."),
});
export type ClarifyingReply = z.infer<typeof ClarifyingReplySchema>;

/**
 * AI-first fallback: when no KB article or procedure matched (e.g. the requester
 * just said "Halo" or sent a vague message), generate a short, friendly reply
 * that greets them and asks a clarifying follow-up question, so the agent always
 * responds instead of going silent. Honours the configured persona/voice.
 *
 * Takes the full interleaved conversation (incl. the agent's own prior replies)
 * so it has memory — it won't re-ask a question it already asked. The stable
 * persona/rules live in `system` (cacheable prefix); the dynamic conversation
 * lives in `messages`.
 */
export async function generateClarifyingReply(params: {
  conversation: ModelMessage[];
  ticketTitle: string;
  behavior?: ProcedureBehavior;
}): Promise<string> {
  const { conversation, ticketTitle, behavior } = params;
  const preamble = behaviorPreamble(behavior);
  const signatureRule = behavior?.replySignature
    ? `\n- Akhiri balasan dengan tanda tangan: ${behavior.replySignature}.`
    : "";

  const system = `${preamble || "Kamu adalah asisten helpdesk SIMRS di RSUD Karawang."}

Konteks: percakapan di bawah belum cukup jelas atau hanya berupa sapaan, sehingga belum ada artikel/prosedur yang cocok.
Tugasmu: balas pesan TERAKHIR requester dengan HANGAT dan RINGKAS (1–3 kalimat) lalu ajukan SATU pertanyaan klarifikasi agar kamu bisa membantu.
Aturan:
- Balas dalam Bahasa Indonesia.
- Perhatikan SELURUH percakapan; JANGAN mengulang pertanyaan atau sapaan yang sudah pernah kamu sampaikan sebelumnya.
- Jangan mengarang solusi atau fakta — kamu hanya menggali kebutuhan requester.
- Jika hanya sapaan, sapa balik dan tanyakan ada kendala SIMRS apa yang bisa dibantu.
- Jangan minta data sensitif (mis. password).${signatureRule}`;

  const { object } = await generateObject({
    model: getAiModel(),
    schema: ClarifyingReplySchema,
    temperature: 0.3,
    system,
    messages: conversation.length
      ? conversation
      : [{ role: "user", content: ticketTitle }],
    experimental_telemetry: aiTelemetry("generate-clarifying-reply"),
  });

  return object.reply.trim();
}

export async function classifyModule(
  title: string,
  description: string | null,
  modules: { id: string; name: string; slug: string }[],
): Promise<ModuleClassification> {
  const moduleList = modules
    .map((module) => `- ID: ${module.id} | Nama: ${module.name} | Slug: ${module.slug}`)
    .join("\n");

  const { object } = await generateObject({
    model: getAiModel(),
    schema: ModuleClassificationSchema,
    experimental_telemetry: aiTelemetry("classify-module"),
    prompt: `Kamu adalah asisten klasifikasi tiket SIMRS untuk RSUD Karawang.

Modul SIMRS yang tersedia:
${moduleList}

Tiket masuk:
Judul: ${title}
Deskripsi: ${description ?? "(tidak ada deskripsi)"}

Tentukan modul SIMRS mana yang paling sesuai. Jika tidak ada modul yang cocok, kembalikan null untuk moduleId dan moduleName. Berikan confidence score dari 0.0 hingga 1.0.`,
  });

  return object;
}

export async function classifyPriority(
  title: string,
  description: string | null,
  currentPriority: string,
): Promise<PriorityClassification> {
  const { object } = await generateObject({
    model: getAiModel(),
    schema: PriorityClassificationSchema,
    experimental_telemetry: aiTelemetry("classify-priority"),
    prompt: `Kamu adalah asisten triase tiket untuk rumah sakit RSUD Karawang.

Tiket masuk:
Judul: ${title}
Deskripsi: ${description ?? "(tidak ada deskripsi)"}
Prioritas saat ini: ${currentPriority}

Tentukan prioritas:
- "critical" = ada isu mendesak sekecil apapun yang berpotensi menyangkut pasien, dokter, down time, macet, atau laporan keluhan.
- "medium" = pertanyaan umum yang butuh segera dijawab, kendala penggunaan, kendala billing/pembayaran, kendala lab/radiologi.
- "low" = HANYA UNTUK sapaan, pesan tidak jelas, atau pertanyaan yang sangat remeh.

Tebak dan naikkan prioritas jika ragu. Berikan penilaian prioritas dan alasannya dalam Bahasa Indonesia.`,
  });

  return object;
}

export type RefineMode = "perbaiki" | "perpendek" | "ramah" | "formal";

const REFINE_INSTRUCTIONS: Record<RefineMode, string> = {
  perbaiki:
    "Rapikan tulisan ini: perbaiki ejaan, tata bahasa, tanda baca, dan kejelasan kalimat. JANGAN mengubah makna, menambah informasi baru, atau menghilangkan poin.",
  perpendek:
    "Persingkat balasan ini. Pertahankan semua poin dan langkah penting, buang basa-basi dan pengulangan.",
  ramah:
    "Ubah nadanya menjadi lebih hangat dan ramah, tetap profesional. Jangan menambah informasi baru.",
  formal:
    "Ubah gaya bahasanya menjadi lebih formal dan baku, cocok untuk komunikasi resmi rumah sakit. Jangan menambah informasi baru.",
};

const RefinedReplySchema = z.object({
  refinedText: z.string().describe("The rewritten reply text in Indonesian."),
});

/**
 * Rewrite an agent-typed (or AI-drafted) reply according to one refine mode,
 * or a free-form instruction written by the agent ("tambahkan salam penutup").
 * Used by the copilot quick actions and the reply box "Rapikan" menu.
 */
export async function refineReplyText(input: {
  text: string;
  mode?: RefineMode;
  customInstruction?: string | null;
  ticketTitle?: string | null;
}): Promise<string> {
  const instruction =
    input.customInstruction?.trim().slice(0, 500) ||
    REFINE_INSTRUCTIONS[input.mode ?? "perbaiki"];

  const { object } = await generateObject({
    model: getAiModel(),
    schema: RefinedReplySchema,
    experimental_telemetry: aiTelemetry("refine-reply", {
      mode: input.mode ?? (input.customInstruction ? "custom" : "perbaiki"),
    }),
    prompt: `Kamu adalah asisten penulisan untuk staf helpdesk SIMRS RSUD Karawang.
Teks di bawah adalah draf balasan staf kepada pelapor tiket${input.ticketTitle ? ` berjudul "${input.ticketTitle}"` : ""}.

Instruksi dari staf: ${instruction}

Aturan:
- Balas dalam Bahasa Indonesia.
- Kembalikan HANYA teks balasan yang sudah diubah, tanpa pengantar atau komentar.
- Jangan mengarang fakta, nama, atau langkah yang tidak ada di teks asli.

Draf balasan:
${input.text}`,
  });

  return object.refinedText.trim();
}

/**
 * Judge whether a retrieved KB article answers the requester's current need and,
 * if so, draft a grounded reply. Sees the full conversation (incl. the agent's
 * prior replies) so the draft fits the thread and doesn't repeat itself. Stable
 * persona/rules in `system` (cacheable); dynamic conversation + KB article in
 * `messages`.
 */
export async function evaluateKbMatch(params: {
  conversation: ModelMessage[];
  ticketTitle: string;
  kbTitle: string;
  kbContent: string;
  behavior?: ProcedureBehavior;
}): Promise<KbRelevance> {
  const { conversation, ticketTitle, kbTitle, kbContent, behavior } = params;
  const preamble = behaviorPreamble(behavior);
  const signatureRule = behavior?.replySignature
    ? `\n- Akhiri balasan dengan tanda tangan: ${behavior.replySignature}.`
    : "";

  const system = `${preamble || "Kamu adalah asisten helpdesk SIMRS di RSUD Karawang."}

Tugasmu: nilai apakah artikel Knowledge Base yang diberikan BERHUBUNGAN dengan kebutuhan requester pada percakapan, lalu—jika relevan—susun balasan yang membantu.
Sebagai AI Helpdesk yang proaktif, beri respons sebisa mungkin jika ada kata kunci yang nyambung (mis. "antrian poli" dengan artikel "antrian").
Aturan:
- Perhatikan seluruh percakapan dan fokus pada pesan TERAKHIR requester; jangan mengulang yang sudah pernah kamu jawab.
- Jika relevan (meski parsial), buat balasan maksimal 3 paragraf yang merangkum solusi dari artikel KB.
- Balas dalam Bahasa Indonesia.${signatureRule}
- Jika sangat jelas tidak ada hubungannya sama sekali, kembalikan isRelevant: false dan suggestedReply: null.`;

  const kbBlock = `Judul tiket: ${ticketTitle}

Artikel Knowledge Base yang ditemukan:
Judul: ${kbTitle}
Isi: ${kbContent.slice(0, 1500)}`;

  const { object } = await generateObject({
    model: getAiModel(),
    schema: KbRelevanceSchema,
    temperature: 0,
    system,
    messages: withTrailingUser(
      conversation.length ? conversation : [{ role: "user", content: ticketTitle }],
      kbBlock,
    ),
    experimental_telemetry: aiTelemetry("evaluate-kb-match", { kbTitle }),
  });

  return object;
}
