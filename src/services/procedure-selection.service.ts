import { generateObject } from "ai";
import { z } from "zod";
import { getAiModel } from "@/lib/ai";

export type SelectionCandidate = { id: string; title: string; whenToUse: string };

export const ProcedureSelectionSchema = z.object({
  procedureId: z.string().nullable().describe("ID of the best-matching procedure, or null if none fit."),
  confidence: z.number().min(0).max(1).describe("Confidence 0.0–1.0 that this procedure applies."),
  reasoning: z.string().describe("Brief reason in Indonesian."),
});
export type ProcedureSelection = z.infer<typeof ProcedureSelectionSchema>;

export function buildSelectionPrompt(ticketText: string, candidates: SelectionCandidate[]): string {
  const list = candidates
    .map((c) => `- ID: ${c.id} | Judul: ${c.title} | Kapan dipakai: ${c.whenToUse || "(tidak diisi)"}`)
    .join("\n");
  return `Kamu adalah router prosedur untuk agen AI helpdesk SIMRS RSUD Karawang.

Tiket masuk:
${ticketText}

Daftar prosedur yang tersedia:
${list}

Pilih SATU prosedur yang paling sesuai dengan tiket berdasarkan deskripsi "Kapan dipakai".
Jika tidak ada yang benar-benar cocok, kembalikan procedureId = null. Jangan memaksakan kecocokan.`;
}

type GenerateFn = (args: { prompt: string }) => Promise<{ object: ProcedureSelection }>;

export async function pickProcedure(
  ticketText: string,
  candidates: SelectionCandidate[],
  opts?: { generate?: GenerateFn; minConfidence?: number },
): Promise<{ procedureId: string; confidence: number; reasoning: string } | null> {
  if (candidates.length === 0) return null;
  const minConfidence = opts?.minConfidence ?? 0.6;
  const generate =
    opts?.generate ??
    ((args) => generateObject({ model: getAiModel(), schema: ProcedureSelectionSchema, prompt: args.prompt }));

  const { object } = await generate({ prompt: buildSelectionPrompt(ticketText, candidates) });
  if (!object.procedureId) return null;
  if (object.confidence < minConfidence) return null;
  // Guard against a hallucinated id not in the candidate set.
  if (!candidates.some((c) => c.id === object.procedureId)) return null;
  return { procedureId: object.procedureId, confidence: object.confidence, reasoning: object.reasoning };
}
