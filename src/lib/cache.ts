import { unstable_cache } from "next/cache";
import { getAllModules, getModulesByUserId, getSlaConfigs } from "@/services/module.service";
import { getAssignableStaff } from "@/services/user.service";
import { getQuickReplies } from "@/services/quick-reply.service";
import { getAllKbArticles, getKbGaps } from "@/services/knowledge.service";

/**
 * Cached version of getAllModules (active only).
 * Revalidated when the "modules" cache tag is invalidated.
 * Stable data — modules rarely change.
 */
export const getCachedActiveModules = unstable_cache(
  () => getAllModules({ activeOnly: true }),
  ["active-modules"],
  { revalidate: 60, tags: ["modules"] }
);

/**
 * Cached version of getAllModules (all).
 */
export const getCachedAllModules = unstable_cache(
  () => getAllModules(),
  ["all-modules"],
  { revalidate: 60, tags: ["modules"] }
);

/**
 * Cached version of getSlaConfigs.
 */
export const getCachedSlaConfigs = unstable_cache(
  () => getSlaConfigs(),
  ["sla-configs"],
  { revalidate: 60, tags: ["sla-configs"] }
);

/**
 * Cached version of getModulesByUserId.
 * Per-user, so keyed by userId.
 */
export const getCachedModulesByUserId = (userId: string, options?: { activeOnly?: boolean }) =>
  unstable_cache(
    () => getModulesByUserId(userId, options),
    [`user-modules-${userId}${options?.activeOnly ? "-active" : ""}`],
    { revalidate: 60, tags: ["modules", `user-modules-${userId}`] }
  )();

/**
 * Cached engineers list — changes only when user roles change.
 */
export const getCachedAssignableStaff = unstable_cache(
  () => getAssignableStaff(),
  ["assignable-staff"],
  { revalidate: 60, tags: ["users"] }
);

/**
 * Cached quick replies — changes only when admin edits them.
 */
export const getCachedQuickReplies = unstable_cache(
  () => getQuickReplies(),
  ["quick-replies"],
  { revalidate: 60, tags: ["quick-replies"] }
);

/**
 * Cached KB articles list — changes when admin adds/edits articles.
 */
export const getCachedKbArticles = unstable_cache(
  () => getAllKbArticles(),
  ["kb-articles"],
  { revalidate: 60, tags: ["knowledge-base"] }
);

/**
 * Cached KB gaps list — derived from resolved tickets without KB links.
 */
export const getCachedKbGaps = (limit: number) =>
  unstable_cache(
    () => getKbGaps(limit),
    [`kb-gaps-${limit}`],
    { revalidate: 60, tags: ["knowledge-base", "tickets"] }
  )();
