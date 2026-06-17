import { getAiConfig } from "@/services/ai-config.service";
import { AgentBehaviorForm } from "@/components/agent/agent-behavior-form";

export default async function AgentBehaviorPage() {
  const config = await getAiConfig();
  return (
    <AgentBehaviorForm
      config={{
        agentName: config.agentName,
        persona: config.persona,
        tone: config.tone,
        language: config.language,
        replySignature: config.replySignature,
        guardrails: config.guardrails,
      }}
    />
  );
}
