"use server";

import { db } from "@/db";
import { users } from "@/db/schema/users";
import { userModules } from "@/db/schema/modules";
import { account } from "../../auth-schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import crypto from "node:crypto";

type UserRole = "owner" | "admin" | "supervisor" | "operator" | "engineer";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | null)?.role;
  if (!session?.user || !["owner", "admin"].includes(role ?? "")) throw new Error("Unauthorized");
  return session;
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`scrypt:${salt}:${derivedKey.toString("hex")}`);
    });
  });
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

  const userId = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);

  await db.insert(users).values({
    id: userId,
    name,
    email,
    emailVerified: true,
    role: role as UserRole,
  });

  await db.insert(account).values({
    id: crypto.randomUUID(),
    accountId: email,
    providerId: "credential",
    userId,
    password: hashedPassword,
  });

  if (moduleIds.length > 0) {
    await db.insert(userModules).values(moduleIds.map((moduleId) => ({ userId, moduleId })));
  }

  revalidatePath("/app/users");
  return { success: true };
}

export async function updateUserRoleAction(userId: string, role: UserRole) {
  await requireAdmin();
  await db.update(users).set({ role }).where(eq(users.id, userId));
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
  revalidatePath("/app/users");
  return { success: true };
}

export async function setUserModulesAction(userId: string, moduleIds: string[]) {
  await requireAdmin();
  await db.delete(userModules).where(eq(userModules.userId, userId));
  if (moduleIds.length > 0) {
    await db.insert(userModules).values(moduleIds.map((moduleId) => ({ userId, moduleId })));
  }
  revalidatePath("/app/users");
  return { success: true };
}
