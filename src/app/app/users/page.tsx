import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getUsers } from "@/services/user.service";
import { getAllModules } from "@/services/module.service";
import { UsersClient } from "@/components/users-client";

export default async function UsersPage() {
  const session = await getSession();
  if (!session?.user) redirect("/");

  const user = session.user as typeof session.user & { role: string };
  if (user.role !== "admin") {
    redirect("/app/tickets");
  }

  const [allUsers, allModules] = await Promise.all([
    getUsers(),
    getAllModules(),
  ]);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Kelola akses, role, dan pembagian modul untuk seluruh tim SIMRS.
          </p>
        </div>
      </div>

      <UsersClient initialUsers={allUsers as any} modules={allModules} />
    </div>
  );
}
