"use server";

import { db } from "@/db";
import { modules, slaConfigs } from "@/db/schema/modules";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | null)?.role;
  if (!session?.user || !["owner", "admin"].includes(role ?? "")) throw new Error("Unauthorized");
}

export async function createModuleAction(formData: FormData) {
  await requireAdmin();
  const name = (formData.get("name") as string)?.trim();
  const color = (formData.get("color") as string)?.trim() || "#94a3b8";
  if (!name) return { error: "Nama modul wajib diisi." };

  const slug = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  try {
    await db.insert(modules).values({ name, slug, color });
  } catch {
    return { error: "Nama atau slug modul sudah ada." };
  }

  revalidatePath("/app");
  return { success: true };
}

export async function updateModuleAction(id: string, formData: FormData) {
  await requireAdmin();
  const name = (formData.get("name") as string)?.trim();
  const color = (formData.get("color") as string)?.trim();
  if (!name) return { error: "Nama modul wajib diisi." };

  await db
    .update(modules)
    .set({ name, color: color || null })
    .where(eq(modules.id, id));

  revalidatePath("/app");
  return { success: true };
}

export async function toggleModuleActiveAction(id: string) {
  await requireAdmin();
  const mod = await db.query.modules.findFirst({
    where: eq(modules.id, id),
    columns: { isActive: true },
  });
  if (!mod) return { error: "Modul tidak ditemukan." };

  await db.update(modules).set({ isActive: !mod.isActive }).where(eq(modules.id, id));
  revalidatePath("/app");
  return { success: true };
}

export async function upsertSlaConfigAction(
  moduleId: string,
  priority: "low" | "medium" | "critical",
  responseTimeMinutes: number,
  resolutionTimeMinutes: number,
) {
  await requireAdmin();
  const existing = await db.query.slaConfigs.findFirst({
    where: and(eq(slaConfigs.moduleId, moduleId), eq(slaConfigs.priority, priority)),
  });

  if (existing) {
    await db
      .update(slaConfigs)
      .set({ responseTimeMinutes, resolutionTimeMinutes })
      .where(eq(slaConfigs.id, existing.id));
  } else {
    await db
      .insert(slaConfigs)
      .values({ moduleId, priority, responseTimeMinutes, resolutionTimeMinutes });
  }

  revalidatePath("/app");
  return { success: true };
}
