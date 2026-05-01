import { unstable_cache } from "next/cache";
import { getAllModules, getModulesByUserId, getSlaConfigs } from "@/services/module.service";
import { getEngineers } from "@/services/user.service";
import { getQuickReplies } from "@/services/quick-reply.service";

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
export const getCachedEngineers = unstable_cache(
  () => getEngineers(),
  ["engineers"],
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
