export type TargetTicketStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "closed";
export type LegacyTicketStatus = TargetTicketStatus | "waiting";

const allowedTransitions: Record<TargetTicketStatus, TargetTicketStatus[]> = {
  open: ["in_progress", "resolved"],
  in_progress: ["open", "resolved"],
  resolved: ["in_progress", "open", "closed"],
  closed: [],
};

export function normalizeTicketStatus(
  status: LegacyTicketStatus,
  assigneeId: string | null | undefined,
): TargetTicketStatus {
  if (status === "waiting") return assigneeId ? "in_progress" : "open";
  return status;
}

export function canTransitionTicketStatus(
  from: LegacyTicketStatus,
  to: TargetTicketStatus,
  assigneeId?: string | null,
): boolean {
  const normalizedFrom = normalizeTicketStatus(from, assigneeId);
  return allowedTransitions[normalizedFrom].includes(to);
}
