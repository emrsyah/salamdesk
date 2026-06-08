import { db } from "@/db";
import { slaConfigs } from "@/db/schema/modules";
import { and, eq } from "drizzle-orm";
import type { TicketPriority } from "./ticket.service";

export function calculateSlaWarningAt(createdAt: Date, dueAt: Date) {
  const durationMs = dueAt.getTime() - createdAt.getTime();
  return new Date(createdAt.getTime() + durationMs * 0.8);
}

export function isHumanPublicStaffReply(input: {
  senderType: "requester" | "staff" | "ai_agent" | "system";
  isInternalNote: boolean;
}) {
  return input.senderType === "staff" && !input.isInternalNote;
}

export async function getSlaDeadlines(input: {
  moduleId: string | null | undefined;
  priority: TicketPriority;
  createdAt: Date;
}) {
  if (!input.moduleId) {
    return { firstResponseDueAt: null, resolutionDueAt: null };
  }

  const config = await db.query.slaConfigs.findFirst({
    where: and(
      eq(slaConfigs.moduleId, input.moduleId),
      eq(slaConfigs.priority, input.priority),
      eq(slaConfigs.isActive, true),
    ),
  });

  if (!config) return { firstResponseDueAt: null, resolutionDueAt: null };

  return {
    firstResponseDueAt: new Date(
      input.createdAt.getTime() + config.responseTimeMinutes * 60_000,
    ),
    resolutionDueAt: new Date(
      input.createdAt.getTime() + config.resolutionTimeMinutes * 60_000,
    ),
  };
}
