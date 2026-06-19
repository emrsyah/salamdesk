import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getUsers } from "@/services/user.service";
import { getAllModules } from "@/services/module.service";
import { UsersClient } from "@/components/users-client";
import { PageContainer, PageHeader } from "@/components/page-shell";
import { RiTeamLine } from "@remixicon/react";

export default async function UsersPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");

  const user = session.user as typeof session.user & { role: string };
  if (!["owner", "admin"].includes(user.role)) {
    redirect("/app/tickets");
  }

  const [allUsers, allModules] = await Promise.all([
    getUsers(),
    getAllModules(),
  ]);

  return (
    <PageContainer>
      <PageHeader
        icon={<RiTeamLine className="size-5" />}
        title="Users"
        description="Kelola akses, role, dan pembagian modul untuk seluruh tim SIMRS."
      />

      <UsersClient initialUsers={allUsers as any} modules={allModules} />
    </PageContainer>
  );
}
