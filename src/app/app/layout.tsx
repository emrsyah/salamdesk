import { HelpdeskSidebar } from "@/components/helpdesk-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getCachedAllModules, getCachedSlaConfigs, getCachedModulesByUserId } from "@/lib/cache";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/");

  const user = session.user as typeof session.user & { role: string };

  // Start all independent fetches in parallel, including the conditional one
  const [allModules, allSlaConfigs, userModules] = await Promise.all([
    getCachedAllModules(),
    getCachedSlaConfigs(),
    // For agents/engineers, we need their assigned modules.
    // For other roles, this resolves to undefined (wasted work is negligible).
    (user.role === "agent" || user.role === "engineer")
      ? getCachedModulesByUserId(user.id, { activeOnly: true })
      : Promise.resolve(undefined),
  ]);

  // Determine which modules to show in the sidebar
  const sidebarModules =
    user.role === "reporter"
      ? []
      : (userModules ?? allModules);

  return (
    <TooltipProvider>
      <SidebarProvider>
        <HelpdeskSidebar user={user} modules={sidebarModules} slaConfigs={allSlaConfigs} />
        <SidebarInset className="overflow-hidden">
          <header className="flex md:hidden h-16 shrink-0 items-center gap-2 border-b px-4">
            <div className="h-4 w-px bg-border" />
          </header>
          <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
