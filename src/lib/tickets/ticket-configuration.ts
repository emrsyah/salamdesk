export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type TicketRoutingMode = "module_queue" | "direct_assignment" | "ai_assisted";

export type TicketConfiguration = {
  routingMode: TicketRoutingMode;
  enabledModuleIds: string[];
  activeStatuses: TicketStatus[];
  terminalStatuses: TicketStatus[];
  resolvedReopenWindowHours: number;
  autoAssignPublicReply: boolean;
  moduleChangeClearsAssignee: boolean;
  requireResolutionNote: boolean;
  allowAiInitialRouting: boolean;
  allowAiPriorityRecommendation: boolean;
};

export const DEFAULT_TICKET_CONFIGURATION: TicketConfiguration = {
  routingMode: "module_queue",
  enabledModuleIds: [],
  activeStatuses: ["open", "in_progress"],
  terminalStatuses: ["closed"],
  resolvedReopenWindowHours: 72,
  autoAssignPublicReply: true,
  moduleChangeClearsAssignee: true,
  requireResolutionNote: true,
  allowAiInitialRouting: true,
  allowAiPriorityRecommendation: true,
};
