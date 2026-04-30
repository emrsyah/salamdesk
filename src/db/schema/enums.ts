import { pgEnum } from "drizzle-orm/pg-core";

export const ticketStatusEnum = pgEnum("ticket_status", ["open", "in_progress", "waiting", "resolved", "closed"]);
export const ticketPriorityEnum = pgEnum("ticket_priority", ["low", "medium", "critical"]);
export const slaStatusEnum = pgEnum("sla_status", ["safe", "warning", "breached"]);
export const ticketSourceEnum = pgEnum("ticket_source", ["whatsapp", "web", "email", "manual"]);
export const userRoleEnum = pgEnum("user_role", ["reporter", "agent", "engineer", "admin"]);
export const senderTypeEnum = pgEnum("sender_type", ["user", "ai_bot", "system"]);
export const resolvedByTypeEnum = pgEnum("resolved_by_type", ["user", "ai"]);
export const rootCauseEnum = pgEnum("root_cause", ["bug", "user_error", "network", "third_party", "configuration", "hardware", "other"]);
export const notificationTypeEnum = pgEnum("notification_type", ["sla_warning", "sla_breached", "escalation", "new_message", "assigned", "resolved"]);