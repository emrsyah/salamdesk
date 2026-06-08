import { pgEnum } from "drizzle-orm/pg-core";

export const ticketStatusEnum = pgEnum("ticket_status", ["open", "in_progress", "waiting", "resolved", "closed"]);
export const ticketPriorityEnum = pgEnum("ticket_priority", ["low", "medium", "critical"]);
export const slaStatusEnum = pgEnum("sla_status", ["safe", "warning", "breached"]);
export const ticketEventTypeEnum = pgEnum("ticket_event_type", [
    "status_changed",
    "assigned",
    "reassigned",
    "takeover",
    "unassigned",
    "module_changed",
    "priority_changed",
    "sla_warning",
    "sla_breached",
    "resolved",
    "manual_close",
    "auto_close",
    "reopened",
    "ai_recommendation_created",
    "ai_recommendation_accepted",
    "ai_recommendation_rejected",
    "linked_ticket_created",
]);
export const ticketLinkTypeEnum = pgEnum("ticket_link_type", [
    "reopened_from",
    "duplicate_of",
]);
export const slaTimerTypeEnum = pgEnum("sla_timer_type", [
    "first_response",
    "resolution",
]);
export const ticketSourceEnum = pgEnum("ticket_source", ["whatsapp", "web", "email", "manual", "api"]);
export const userRoleEnum = pgEnum("user_role", ["owner", "admin", "supervisor", "operator", "engineer"]);
export const requesterIdentityChannelEnum = pgEnum("requester_identity_channel", ["whatsapp", "web", "api", "email"]);
export const senderTypeEnum = pgEnum("sender_type", ["requester", "staff", "ai_agent", "system"]);
export const resolvedByTypeEnum = pgEnum("resolved_by_type", ["user", "ai"]);
export const rootCauseEnum = pgEnum("root_cause", ["bug", "user_error", "network", "third_party", "configuration", "hardware", "other"]);
export const notificationTypeEnum = pgEnum("notification_type", ["sla_warning", "sla_breached", "escalation", "new_message", "assigned", "resolved"]);
