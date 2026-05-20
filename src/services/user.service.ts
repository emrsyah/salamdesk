import { db } from "@/db";
import { users } from "@/db/schema/users";
import { userModules } from "@/db/schema/modules";
import { eq, asc } from "drizzle-orm";

export async function getUsers() {
  return db.query.users.findMany({
    columns: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      phone: true,
      createdAt: true,
    },
    with: {
      modules: {
        with: {
          module: { columns: { id: true, name: true, color: true } },
        },
      },
    },
    orderBy: [asc(users.name)],
  });
}

export async function getUserModuleIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ moduleId: userModules.moduleId })
    .from(userModules)
    .where(eq(userModules.userId, userId));
  return rows.map((r) => r.moduleId);
}
export async function getEngineers() {
  return db.query.users.findMany({
    where: eq(users.role, "engineer"),
    columns: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: [asc(users.name)],
  });
}

export async function getAssignableStaff() {
  return db.query.users.findMany({
    where: eq(users.isActive, true),
    columns: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: [asc(users.name)],
  });
}
