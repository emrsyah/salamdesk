"use server";

import { db } from "@/db";
import { users } from "@/db/schema/users";
import { userModules } from "@/db/schema/modules";
import { eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";

type UserRole = "owner" | "admin" | "supervisor" | "operator" | "engineer";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | null)?.role;
  if (!session?.user || !["owner", "admin"].includes(role ?? "")) throw new Error("Unauthorized");
  return session;
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = (formData.get("password") as string)?.trim();
  const role = formData.get("role") as string;
  const moduleIds = formData.getAll("moduleIds") as string[];

  if (!name || !email || !password || !role) {
    return { error: "Semua field wajib diisi." };
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) return { error: "Email sudah terdaftar." };

  // Create the user + credential through Better Auth so the password is hashed
  // with the same scheme the login flow verifies against.
  let userId: string;
  try {
    const created = await auth.api.signUpEmail({
      body: { name, email, password, role, vendor: "", isActive: true },
    });
    userId = created.user.id;
  } catch {
    return { error: "Gagal membuat user." };
  }

  // signUpEmail won't mark the email verified.
  await db
    .update(users)
    .set({ emailVerified: true })
    .where(eq(users.id, userId));

  if (moduleIds.length > 0) {
    await db.insert(userModules).values(moduleIds.map((moduleId) => ({ userId, moduleId })));
    updateTag(`user-modules-${userId}`);
    updateTag("modules");
  }

  updateTag("users");
  revalidatePath("/app/users");
  return { success: true };
}

export async function updateUserRoleAction(userId: string, role: UserRole) {
  await requireAdmin();
  await db.update(users).set({ role }).where(eq(users.id, userId));
  updateTag("users");
  revalidatePath("/app/users");
  return { success: true };
}

export async function toggleUserActiveAction(userId: string) {
  await requireAdmin();
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { isActive: true },
  });
  if (!user) return { error: "User tidak ditemukan." };
  await db.update(users).set({ isActive: !user.isActive }).where(eq(users.id, userId));
  updateTag("users");
  revalidatePath("/app/users");
  return { success: true };
}

export async function setUserModulesAction(userId: string, moduleIds: string[]) {
  await requireAdmin();
  await db.delete(userModules).where(eq(userModules.userId, userId));
  if (moduleIds.length > 0) {
    await db.insert(userModules).values(moduleIds.map((moduleId) => ({ userId, moduleId })));
  }
  updateTag(`user-modules-${userId}`);
  updateTag("modules");
  revalidatePath("/app/users");
  return { success: true };
}
