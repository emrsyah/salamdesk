"use client"

import * as React from "react"

import type { ComponentProps } from "react"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { NavUser } from "@/components/nav-user"
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
} from "@/components/ui/sidebar"
import {
  RiBarChartBoxLine,
  RiBook3Line,
  RiCommandLine,
  RiErrorWarningLine,
  RiHospitalLine,
  RiInboxLine,
  RiSparklingLine,
  RiTeamLine,
  RiTimerLine,
  RiUserLine,
} from "@remixicon/react"

// Navigation types
type NavItem = {
  title: string
  url: string
  icon: React.ReactNode
  isLainnya?: boolean
}

// ANTRIAN items
const ANTRIAN_ITEMS: NavItem[] = [
  {
    title: "Semua Tiket",
    url: "/app/tickets",
    icon: <RiInboxLine />,
  },
  {
    title: "Saya",
    url: "/app/tickets?assignee=me",
    icon: <RiUserLine />,
  },
  {
    title: "Kritis",
    url: "/app/tickets?priority=critical",
    icon: <RiErrorWarningLine />,
  },
  {
    title: "SLA Terlewat",
    url: "/app/tickets?sla=breached",
    icon: <RiTimerLine />,
  },
  {
    title: "Diselesaikan AI",
    url: "/app/tickets?tab=done&resolvedBy=ai",
    icon: <RiSparklingLine />,
  },
]

// MODUL SIMRS items (placeholder - will be dynamic)
const MODUL_ITEMS: NavItem[] = [
  {
    title: "IGD",
    url: "/app/tickets?module=igd",
    icon: <RiHospitalLine />,
  },
  {
    title: "Poliklinik",
    url: "/app/tickets?module=policlinic",
    icon: <RiHospitalLine />,
  },
  {
    title: "Rawat Inap",
    url: "/app/tickets?module=inpatient",
    icon: <RiHospitalLine />,
  },
]

// LAINNYA items
const LAINNYA_ITEMS: NavItem[] = [
  {
    title: "Knowledge Base",
    url: "/app/knowledge",
    icon: <RiBook3Line />,
    isLainnya: true,
  },
  {
    title: "Analytics",
    url: "/app/analytic",
    icon: <RiBarChartBoxLine />,
    isLainnya: true,
  },
  {
    title: "Users",
    url: "/app/users",
    icon: <RiTeamLine />,
    isLainnya: true,
  },
]


export function HelpdeskSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { setOpen } = useSidebar()

  // Determine if current page is tickets (has L2 tabs)
  const isTicketsPage = pathname.startsWith("/app/tickets")


  const isItemActive = (item: NavItem): boolean => {
    if (item.isLainnya) {
      return pathname === item.url
    }

    // For tickets items, check if we're on tickets page and params match
    if (!isTicketsPage) return false

    const itemParams = new URLSearchParams(item.url.split("?")[1] || "")

    // Check if all params in item URL match current URL
    for (const [key, value] of itemParams.entries()) {
      if (searchParams.get(key) !== value) return false
    }

    // For items without specific params, check if we're on tickets
    if (itemParams.toString() === "" && isTicketsPage) {
      // Check if we have any ticket-specific params (except 'tab' which is just sub-navigation for 'Semua Tiket')
      const hasTicketParams =
        searchParams.has("assignee") ||
        searchParams.has("priority") ||
        searchParams.has("sla") ||
        searchParams.has("module") ||
        searchParams.has("resolvedBy")
      return !hasTicketParams
    }

    return true
  }

  // Handle L1 item click
  const handleItemClick = (item: NavItem) => {
    router.push(item.url)
    if (window.innerWidth < 768) {
      setOpen(false)
    }
  }


  // User data (placeholder)
  const userData = {
    name: "Admin",
    email: "admin@salamdesk.com",
    avatar: "/avatars/admin.jpg",
  }

  return (
    <Sidebar
      collapsible="icon"
      {...props}
    >
      <SidebarHeader>
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-2">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <RiCommandLine className="size-4" />
            </div>
            <div className="text-sm font-medium group-data-[collapsible=icon]:hidden">SalamDesk</div>
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <SidebarTrigger className="size-6 shrink-0" />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {/* ANTRIAN Group */}
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">ANTRIAN</SidebarGroupLabel>
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

        {/* MODUL SIMRS Group */}
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">MODUL SIMRS</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MODUL_ITEMS.map((item) => (
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

        {/* LAINNYA Group */}
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">LAINNYA</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {LAINNYA_ITEMS.map((item) => (
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
        <NavUser user={userData} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
