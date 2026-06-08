"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import type { ComponentProps } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { NavUser } from "@/components/nav-user";
import { SettingsDialog } from "@/components/settings-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  RiBarChartBoxLine,
  RiBook3Line,
  RiCodeSSlashLine,
  RiCommandLine,
  RiDashboardLine,
  RiErrorWarningLine,
  RiHospitalLine,
  RiInboxLine,
  RiSettings3Line,
  RiSparklingLine,
  RiTeamLine,
  RiTimerLine,
  RiUserLine,
} from "@remixicon/react";

type AppUser = { id: string; name: string; email: string; role: string };
type Module = { id: string; name: string; color: string | null; slug: string; isActive: boolean };
type SlaConfig = {
  id: string;
  moduleId: string;
  priority: "low" | "medium" | "critical";
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
  isActive: boolean;
};

type NavItem = {
  title: string;
  url: string;
  icon: React.ReactNode;
  isLainnya?: boolean;
  adminOnly?: boolean;
};

const ANTRIAN_ITEMS: NavItem[] = [
  { title: "Semua Tiket", url: "/app/tickets", icon: <RiInboxLine /> },
  { title: "Saya", url: "/app/tickets?assignee=me", icon: <RiUserLine /> },
  { title: "Kritis", url: "/app/tickets?priority=critical", icon: <RiErrorWarningLine /> },
  { title: "SLA Terlewat", url: "/app/tickets?sla=breached", icon: <RiTimerLine /> },
  { title: "Diselesaikan AI", url: "/app/tickets?tab=done&resolvedBy=ai", icon: <RiSparklingLine /> },
];

const LAINNYA_ITEMS: NavItem[] = [
  { title: "Dashboard", url: "/app/dashboard", icon: <RiDashboardLine />, isLainnya: true },
  { title: "Knowledge Base", url: "/app/knowledge", icon: <RiBook3Line />, isLainnya: true },
  //{ title: "Analytics", url: "/app/analytic", icon: <RiBarChartBoxLine />, isLainnya: true },
  { title: "Users", url: "/app/users", icon: <RiTeamLine />, isLainnya: true, adminOnly: true },
  { title: "WhatsApp", url: "/app/whatsapp", icon: <RiCommandLine />, isLainnya: true, adminOnly: true },
  { title: "Developer API", url: "/app/settings/developer", icon: <RiCodeSSlashLine />, isLainnya: true, adminOnly: true },
];

interface HelpdeskSidebarProps extends ComponentProps<typeof Sidebar> {
  user: AppUser;
  modules: Module[];
  slaConfigs: SlaConfig[];
}

export function HelpdeskSidebar({ user, modules, slaConfigs, ...props }: HelpdeskSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setOpen } = useSidebar();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isTicketsPage = pathname.startsWith("/app/tickets");

  // Privileged roles, kept in lockstep with middleware.ts adminRoutes guard.
  const isAdmin = user.role === "admin" || user.role === "owner";

  const lainnyaItems = useMemo(
    () => LAINNYA_ITEMS.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin]
  );

  const moduleNavItems: NavItem[] = useMemo(() => modules.filter((m) => m.isActive).map((m) => ({
    title: m.name,
    url: `/app/tickets?module=${m.slug}`,
    icon: (
      <span
        className="size-3.5 rounded-sm inline-block shrink-0"
        style={{ backgroundColor: m.color ?? "#94a3b8" }}
      />
    ),
  })), [modules]);


  const isItemActive = (item: NavItem): boolean => {
    if (item.isLainnya) return pathname === item.url;
    if (!isTicketsPage) return false;

    const itemParams = new URLSearchParams(item.url.split("?")[1] || "");
    for (const [key, value] of itemParams.entries()) {
      if (searchParams.get(key) !== value) return false;
    }

    if (itemParams.toString() === "" && isTicketsPage) {
      const hasTicketParams =
        searchParams.has("assignee") ||
        searchParams.has("priority") ||
        searchParams.has("sla") ||
        searchParams.has("module") ||
        searchParams.has("resolvedBy");
      return !hasTicketParams;
    }

    return true;
  };

  const handleItemClick = (item: NavItem) => {
    router.push(item.url);
    if (window.innerWidth < 768) setOpen(false);
  };

  return (
    <>
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-2">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground overflow-hidden">
                <img src="/android-chrome-512x512.png" alt="SalamDesk Logo" className="size-full object-cover" />
              </div>
              <div className="text-sm font-medium group-data-[collapsible=icon]:hidden">
                SalamDesk
              </div>
            </div>
            <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">
              {isAdmin && (
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                  title="Pengaturan"
                >
                  <RiSettings3Line className="size-4" />
                </button>
              )}
              <SidebarTrigger className="size-6 shrink-0" />
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
              ANTRIAN
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ANTRIAN_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      onClick={() => handleItemClick(item)}
                      isActive={isItemActive(item)}
                      tooltip={item.title}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
              MODUL SIMRS
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {moduleNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      onClick={() => handleItemClick(item)}
                      isActive={isItemActive(item)}
                      tooltip={item.title}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {moduleNavItems.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                    Belum ada modul aktif
                  </div>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
              LAINNYA
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {lainnyaItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      onClick={() => handleItemClick(item)}
                      isActive={isItemActive(item)}
                      tooltip={item.title}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <NavUser user={user} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      {isAdmin && (
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          modules={modules}
          slaConfigs={slaConfigs}
        />
      )}
    </>
  );
}
