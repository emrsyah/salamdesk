import { listTools, listCredentials } from "@/services/agent-tools.service";
import { AgentToolsClient } from "@/components/agent/agent-tools-client";

export default async function AgentToolsPage() {
  const [tools, credentials] = await Promise.all([listTools(), listCredentials()]);
  return (
    <AgentToolsClient
      tools={tools.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        type: t.type,
        config: t.config,
        credentialId: t.credentialId,
        enabled: t.enabled,
      }))}
      credentials={credentials}
    />
  );
}
