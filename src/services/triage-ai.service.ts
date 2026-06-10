import { generateObject } from "ai";
import { z } from "zod";
import { getAiModel } from "@/lib/ai";

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
    prompt: `Kamu adalah asisten triase tiket untuk rumah sakit RSUD Karawang.

Tiket masuk:
Judul: ${title}
Deskripsi: ${description ?? "(tidak ada deskripsi)"}
Prioritas saat ini: ${currentPriority}

Tentukan prioritas:
- "critical" = mempengaruhi banyak pasien, sistem down, antrian macet, tidak bisa akses sama sekali
- "medium" = ada masalah tapi masih bisa disiasati, atau tidak mendesak
- "low" = pertanyaan, permintaan informasi, atau keluhan minor

Berikan penilaian prioritas dan alasannya dalam Bahasa Indonesia.`,
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

export async function evaluateKbMatch(
  title: string,
  description: string | null,
  kbTitle: string,
  kbContent: string,
): Promise<KbRelevance> {
  const { object } = await generateObject({
    model: getAiModel(),
    schema: KbRelevanceSchema,
    prompt: `Kamu adalah asisten helpdesk SIMRS di RSUD Karawang.

Tiket dari requester:
Judul: ${title}
Deskripsi: ${description ?? "(tidak ada deskripsi)"}

Artikel Knowledge Base yang ditemukan:
Judul: ${kbTitle}
Isi: ${kbContent.slice(0, 1500)}

Apakah artikel KB ini dapat menjawab pertanyaan atau masalah requester?
Jika ya, buat balasan yang membantu dalam Bahasa Indonesia, maksimal 3 paragraf, yang merangkum solusi dari artikel KB tersebut.
Jika tidak relevan, kembalikan isRelevant: false dan suggestedReply: null.`,
  });

  return object;
}
