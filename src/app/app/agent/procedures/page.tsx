import { listProcedures } from "@/services/agent-procedures.service";
import { getMentionSources } from "@/services/agent-mention-sources.service";
import { getAiConfig } from "@/services/ai-config.service";
import { ProceduresClient } from "@/components/agent/procedures-client";
import type { ProcedureContent } from "@/lib/agent/procedure-content";

export default async function AgentProceduresPage() {
  const [procedures, sources, config] = await Promise.all([
    listProcedures(),
    getMentionSources(),
    getAiConfig(),
  ]);
  return (
    <ProceduresClient
      proceduresEnabled={config.proceduresEnabled}
      procedures={procedures.map((p) => ({
        id: p.id,
        title: p.title,
        whenToUse: p.whenToUse,
        content: p.content as ProcedureContent,
        enabled: p.enabled,
        order: p.order,
      }))}
      sources={sources}
    />
  );
}
