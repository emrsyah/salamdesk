import { getAiConfig } from "@/services/ai-config.service";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/agent/business-hours";
import { AgentAutomationForm } from "@/components/agent/agent-automation-form";

export default async function AgentAutomationPage() {
  const config = await getAiConfig();
  return (
    <AgentAutomationForm
      config={{
        aiTriageEnabled: config.aiTriageEnabled,
        autoClassifyModule: config.autoClassifyModule,
        moduleConfidenceThreshold: config.moduleConfidenceThreshold,
        autoSetPriority: config.autoSetPriority,
        kbCrossModuleSearch: config.kbCrossModuleSearch,
        procedureConfidenceThreshold: config.procedureConfidenceThreshold,
        offTopicGuardEnabled: config.offTopicGuardEnabled,
        aiFirstMode: config.aiFirstMode,
        autoReplyEnabled: config.autoReplyEnabled,
        replyConfidenceThreshold: config.replyConfidenceThreshold,
        autoReplyDelayMinutes: config.autoReplyDelayMinutes,
        autoReplyChannels: config.autoReplyChannels,
        skipCriticalPriority: config.skipCriticalPriority,
        requireKbGrounding: config.requireKbGrounding,
        blockedKeywords: config.blockedKeywords,
        limitAutoRepliesPerTicket: config.limitAutoRepliesPerTicket,
        maxAutoRepliesPerTicket: config.maxAutoRepliesPerTicket,
        businessHours: config.businessHours ?? DEFAULT_BUSINESS_HOURS,
        offHoursReplyEnabled: config.offHoursReplyEnabled,
        offHoursMessage: config.offHoursMessage,
      }}
    />
  );
}
