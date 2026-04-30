import { db } from "@/db";
import { modules } from "@/db/schema/modules";
import { eq } from "drizzle-orm";

export async function getModules() {
  return db
    .select({ id: modules.id, name: modules.name, color: modules.color, slug: modules.slug })
    .from(modules)
    .where(eq(modules.isActive, true));
}
