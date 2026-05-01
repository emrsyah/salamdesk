import { db } from "@/db";
import { modules } from "@/db/schema/modules";
import { eq, and } from "drizzle-orm";

export type Module = typeof modules.$inferSelect;
export type ModuleWithRelations = Module & {
  slaConfigs?: any;
  quickReplies?: any;
};

/**
 * Get all modules, optionally filtered by active status
 */
export async function getAllModules(options?: { activeOnly?: boolean }): Promise<Module[]> {
  const filters = [];
  
  if (options?.activeOnly) {
    filters.push(eq(modules.isActive, true));
  }

  return await db
    .select()
    .from(modules)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(modules.name)
    .execute();
}

/**
 * Get a module by ID
 */
export async function getModuleById(id: string): Promise<Module | null> {
  const result = await db
    .select()
    .from(modules)
    .where(eq(modules.id, id))
    .limit(1)
    .execute();

  return result[0] ?? null;
}

/**
 * Get a module by slug
 */
export async function getModuleBySlug(slug: string): Promise<Module | null> {
  const result = await db
    .select()
    .from(modules)
    .where(eq(modules.slug, slug))
    .limit(1)
    .execute();

  return result[0] ?? null;
}

/**
 * Get modules assigned to a specific user
 */
export async function getModulesByUserId(userId: string, options?: { activeOnly?: boolean }): Promise<Module[]> {
  const { userModules } = await import("@/db/schema/modules");

  const filters = [eq(userModules.userId, userId)];
  
  if (options?.activeOnly) {
    filters.push(eq(modules.isActive, true));
  }

  return await db
    .select({
      id: modules.id,
      name: modules.name,
      slug: modules.slug,
      color: modules.color,
      isActive: modules.isActive,
      createdAt: modules.createdAt,
    })
    .from(modules)
    .innerJoin(userModules, eq(userModules.moduleId, modules.id))
    .where(and(...filters))
    .orderBy(modules.name)
    .execute();
}

/**
 * Get all SLA configurations
 */
export async function getSlaConfigs(): Promise<any[]> {
  const { slaConfigs } = await import("@/db/schema/modules");
  return await db.select().from(slaConfigs).where(eq(slaConfigs.isActive, true)).execute();
}

