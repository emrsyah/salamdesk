import { getAiConfig } from "@/services/ai-config.service";
import { listTools, listCredentials } from "@/services/agent-tools.service";
import { listProcedures } from "@/services/agent-procedures.service";
import { getMentionSources } from "@/services/agent-mention-sources.service";
import { AgentCanvas } from "@/components/agent/canvas/agent-canvas";
import type { CanvasEmbedData } from "@/components/agent/canvas/canvas-data";
import type { ProcedureContent } from "@/lib/agent/procedure-content";

export default async function AgentCanvasPage() {
  // The embed-kind node drawers (tools, procedures) reuse the existing self-saving
  // tab components, which expect their list data as server props so their
  // `router.refresh()` reloads it. Fetch it here alongside the config.
  const [config, tools, credentials, procedures, sources] = await Promise.all([
    getAiConfig(),
    listTools(),
    listCredentials(),
    listProcedures(),
    getMentionSources(),
  ]);

  const embedData: CanvasEmbedData = {
    tools: tools.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      type: t.type,
      config: t.config,
      credentialId: t.credentialId,
      enabled: t.enabled,
    })),
    credentials,
    procedures: procedures.map((p) => ({
      id: p.id,
      title: p.title,
      whenToUse: p.whenToUse,
      content: p.content as ProcedureContent,
      enabled: p.enabled,
      order: p.order,
    })),
    sources,
  };

  return <AgentCanvas config={config} embedData={embedData} />;
}
