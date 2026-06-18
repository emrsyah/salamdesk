import type { ToolSet } from "ai";
import { listEnabledProcedures, type AgentProcedureRow } from "./agent-procedures.service";
import { pickProcedure } from "./procedure-selection.service";
import {
  runProcedure,
  type ProcedureBehavior,
  type KbGroundingDoc,
  type ProcedureRunResult,
} from "./procedure-execution.service";
import { buildAgentTools } from "./agent-tool-executor.service";
import { getKbArticleById } from "./knowledge.service";
import { collectRefIds, serializeContentToText, type ProcedureContent } from "@/lib/agent/procedure-content";

export type ProcedureRuntimeResult = ProcedureRunResult & {
  procedureId: string;
  procedureTitle: string;
  confidence: number;
};

type Deps = {
  listEnabled: () => Promise<AgentProcedureRow[]>;
  select: typeof pickProcedure;
  loadKb: (ids: string[]) => Promise<KbGroundingDoc[]>;
  buildTools: () => Promise<ToolSet>;
  run: typeof runProcedure;
};

const defaultDeps: Deps = {
  listEnabled: listEnabledProcedures,
  select: pickProcedure,
  loadKb: async (ids) => {
    const docs = await Promise.all(ids.map((id) => getKbArticleById(id)));
    return docs.flatMap((d) => (d ? [{ title: d.title, content: d.content ?? "" }] : []));
  },
  buildTools: buildAgentTools,
  run: runProcedure,
};

/**
 * Try to match and run a procedure for a ticket. Returns null when there are no
 * enabled procedures or none matches — callers then fall back to the KB path.
 * Pure orchestration; all IO is injected so it's unit-testable without DB/AI.
 */
export async function tryProcedure(
  input: { ticketText: string; moduleName: string | null; behavior: ProcedureBehavior },
  deps: Partial<Deps> = {},
): Promise<ProcedureRuntimeResult | null> {
  const d = { ...defaultDeps, ...deps };
  const procedures = await d.listEnabled();
  if (procedures.length === 0) return null;

  const selection = await d.select(
    input.ticketText,
    procedures.map((p) => ({ id: p.id, title: p.title, whenToUse: p.whenToUse })),
  );
  if (!selection) return null;

  const matched = procedures.find((p) => p.id === selection.procedureId);
  if (!matched) return null;

  const content = matched.content as ProcedureContent;
  const kbGrounding = await d.loadKb(collectRefIds(content, "kb"));
  const tools = await d.buildTools();

  const run = await d.run({
    ticketText: input.ticketText,
    behavior: input.behavior,
    procedureTitle: matched.title,
    stepsText: serializeContentToText(content),
    kbGrounding,
    moduleName: input.moduleName,
    tools,
  });

  return { ...run, procedureId: matched.id, procedureTitle: matched.title, confidence: selection.confidence };
}
