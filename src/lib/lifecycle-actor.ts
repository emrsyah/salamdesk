import { getCachedModulesByUserId } from "@/lib/cache";
import type { TicketLifecycleActor } from "@/services/ticket-lifecycle.service";

type SessionUser = {
  id: string;
  role?: string | null;
};

const STAFF_ROLES = ["owner", "admin", "supervisor", "operator", "engineer"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

function normalizeStaffRole(role: string | null | undefined): StaffRole {
  return STAFF_ROLES.includes(role as StaffRole) ? (role as StaffRole) : "operator";
}

export async function buildStaffLifecycleActor(
  user: SessionUser,
): Promise<TicketLifecycleActor> {
  const role = normalizeStaffRole(user.role);
  const modules =
    role === "owner" || role === "admin" || role === "supervisor"
      ? []
      : await getCachedModulesByUserId(user.id, { activeOnly: true });

  return {
    type: "staff",
    id: user.id,
    role,
    moduleIds: modules.map((module) => module.id),
  };
}
