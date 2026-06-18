import { generateText, stepCountIs, type ToolSet } from "ai";
import { getAiModel } from "@/lib/ai";

export const MAX_PROCEDURE_STEPS = 5; // bounds the tool-calling loop (guardrail: max calls/ticket)

export type ProcedureBehavior = {
  agentName: string;
  persona: string;
  tone: string;
  language: string;
  replySignature: string;
  guardrails: string;
};
export type KbGroundingDoc = { title: string; content: string };

export function assembleSystemPrompt(input: {
  behavior: ProcedureBehavior;
  procedureTitle: string;
  stepsText: string;
  kbGrounding: KbGroundingDoc[];
  moduleName: string | null;
}): string {
  const { behavior, procedureTitle, stepsText, kbGrounding, moduleName } = input;
  const kb = kbGrounding.length
    ? kbGrounding.map((d) => `### ${d.title}\n${d.content.slice(0, 1500)}`).join("\n\n")
    : "(tidak ada artikel KB yang dirujuk)";
  return `Kamu adalah ${behavior.agentName || "asisten AI"}, agen helpdesk SIMRS RSUD Karawang.
${behavior.persona ? `Peran/persona: ${behavior.persona}` : ""}
${behavior.tone ? `Nada bicara: ${behavior.tone}` : ""}
Bahasa balasan: ${behavior.language || "id"}.
${behavior.guardrails ? `Batasan WAJIB: ${behavior.guardrails}` : ""}
${moduleName ? `Modul tiket: ${moduleName}.` : ""}

Ikuti PROSEDUR berikut langkah demi langkah ("${procedureTitle}"):
${stepsText}

Saat sebuah langkah menyebut [Tool: ...], panggil tool yang sesuai. Saat menyebut [KB: ...],
dasarkan jawabanmu HANYA pada materi KB di bawah. Jangan mengarang fakta di luar KB/hasil tool.

Materi Knowledge Base yang dirujuk:
${kb}

Tulis balasan akhir untuk pelapor dalam Bahasa Indonesia${
    behavior.replySignature ? `, akhiri dengan tanda tangan: ${behavior.replySignature}` : ""
  }.`;
}

// We read only the fields we depend on. `toolResults[].output` is the v6 field
// carrying each tool's return value (our HTTP/Exa tools return `{ ok, ... }`).
type StepShape = { toolCalls?: unknown[]; toolResults?: { output?: unknown }[] };
type GenerateTextResult = { text: string; steps?: StepShape[] };
type GenerateTextFn = (args: {
  system: string;
  prompt: string;
  tools: ToolSet;
  stopWhen?: unknown;
}) => Promise<GenerateTextResult>;

export type ProcedureRunResult = {
  reply: string;
  action: "send" | "draft-only" | "escalate";
  toolCalls: number;
  hadToolError: boolean;
};

export async function runProcedure(input: {
  ticketText: string;
  behavior: ProcedureBehavior;
  procedureTitle: string;
  stepsText: string;
  kbGrounding: KbGroundingDoc[];
  moduleName: string | null;
  tools: ToolSet;
  generate?: GenerateTextFn;
}): Promise<ProcedureRunResult> {
  const system = assembleSystemPrompt(input);
  const generate: GenerateTextFn =
    input.generate ??
    ((args) =>
      generateText({
        model: getAiModel(),
        system: args.system,
        prompt: args.prompt,
        tools: args.tools,
        stopWhen: args.stopWhen as Parameters<typeof generateText>[0]["stopWhen"],
      }) as unknown as Promise<GenerateTextResult>);

  const result = await generate({
    system,
    prompt: input.ticketText,
    tools: input.tools,
    stopWhen: stepCountIs(MAX_PROCEDURE_STEPS),
  });

  let toolCalls = 0;
  let hadToolError = false;
  for (const step of result.steps ?? []) {
    toolCalls += step.toolCalls?.length ?? 0;
    for (const r of step.toolResults ?? []) {
      const out = r.output as { ok?: boolean } | undefined;
      if (out && out.ok === false) hadToolError = true;
    }
  }

  // Guardrail: never auto-send a reply built on a failed tool call.
  const action: ProcedureRunResult["action"] = hadToolError ? "draft-only" : "send";
  return { reply: (result.text ?? "").trim(), action, toolCalls, hadToolError };
}
