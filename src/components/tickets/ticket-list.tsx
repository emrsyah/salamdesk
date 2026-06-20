"use client";

import { useState, useMemo, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  RiSearchLine,
  RiAddLine,
  RiFilter3Line,
  RiArrowUpDownLine,
  RiCloseLine,
  RiNotification3Line,
  RiNotificationOffLine,
} from "@remixicon/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TicketListItem, type TicketListEntry } from "./ticket-list-item";
import { useTicketEvents } from "./ticket-events-context";
import { useQueryParams } from "@/hooks/use-query-params";
import type { TicketConfiguration } from "@/lib/tickets/ticket-configuration";

import { cn } from "@/lib/utils";

type Module = { id: string; name: string; color: string | null; slug: string };

type PriorityFilter = "all" | TicketListEntry["priority"];
type SlaFilter = "all" | "safe" | "warning" | "breached";
type AssignmentFilter = "all" | "assigned" | "unassigned";
type SortKey = "newest" | "oldest" | "priority" | "sla";

const PRIORITY_FILTER_LABELS: Record<PriorityFilter, string> = {
  all: "Semua prioritas",
  critical: "Kritis",
  medium: "Normal",
  low: "Rendah",
};

const SLA_FILTER_LABELS: Record<SlaFilter, string> = {
  all: "Semua SLA",
  safe: "Aman",
  warning: "Peringatan",
  breached: "Terlampaui",
};

const ASSIGNMENT_FILTER_LABELS: Record<AssignmentFilter, string> = {
  all: "Semua penugasan",
  assigned: "Ditugaskan",
  unassigned: "Belum ditugaskan",
};

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Terbaru",
  oldest: "Terlama",
  priority: "Prioritas tertinggi",
  sla: "SLA paling mendesak",
};

// Lower index = listed first when sorting.
const PRIORITY_RANK: Record<TicketListEntry["priority"], number> = {
  critical: 0,
  medium: 1,
  low: 2,
};

const SLA_RANK: Record<"safe" | "warning" | "breached", number> = {
  breached: 0,
  warning: 1,
  safe: 2,
};

// The resolution badge falls back to slaStatus, so mirror that for filter/sort.
function effectiveSlaStatus(t: TicketListEntry): "safe" | "warning" | "breached" {
  return t.resolutionSlaStatus ?? t.slaStatus;
}

// Newest activity = last customer message, falling back to creation time. This
// is what floats tickets with a fresh inbound message to the top.
function activityTime(t: TicketListEntry): number {
  return new Date(t.lastInboundAt ?? t.createdAt).getTime();
}

interface TicketListProps {
  tickets: TicketListEntry[];
  modules: Module[];
  configuration: TicketConfiguration;
  configurationControl?: React.ReactNode;
  onTicketCreated?: () => void;
}

/** Sticky divider that separates the resolved/closed groups in the done tab. */
function ListSectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="sticky top-0 z-[1] flex items-center gap-2 border-b bg-background/85 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/70">
      {label}
      <span className="text-muted-foreground/60">{count}</span>
    </div>
  );
}

type Tab = "inbox" | "done";

const TAB_STATUSES: Record<Tab, TicketListEntry["status"][]> = {
  inbox: ["open", "in_progress"],
  done: ["resolved", "closed"],
};

// Set form for O(1) membership checks in the per-ticket counting loop.
const TAB_STATUS_SETS: Record<Tab, Set<TicketListEntry["status"]>> = {
  inbox: new Set(TAB_STATUSES.inbox),
  done: new Set(TAB_STATUSES.done),
};

const TAB_LABELS: Record<Tab, string> = {
  inbox: "Inbox",
  done: "Selesai",
};

export function TicketList({ tickets, modules, configuration, configurationControl, onTicketCreated }: TicketListProps) {
  const { searchParams, setQueryParam } = useQueryParams();
  const { soundEnabled, setSoundEnabled } = useTicketEvents();
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [slaFilter, setSlaFilter] = useState<SlaFilter>("all");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const tab = (searchParams.get("tab") ?? "inbox") as Tab;
  const selectedId = searchParams.get("selected");
  const enabledModules = useMemo(() => {
    if (configuration.enabledModuleIds.length === 0) return modules;
    const enabledIds = new Set(configuration.enabledModuleIds);
    return modules.filter((module) => enabledIds.has(module.id));
  }, [configuration.enabledModuleIds, modules]);

  const activeFilterCount =
    (priorityFilter !== "all" ? 1 : 0) +
    (moduleFilter !== "all" ? 1 : 0) +
    (slaFilter !== "all" ? 1 : 0) +
    (assignmentFilter !== "all" ? 1 : 0);

  const resetFilters = () => {
    setPriorityFilter("all");
    setModuleFilter("all");
    setSlaFilter("all");
    setAssignmentFilter("all");
  };

  const filteredTickets = useMemo(() => {
    const statuses = TAB_STATUSES[tab] ?? TAB_STATUSES.inbox;
    const q = search.toLowerCase();
    const filtered = tickets.filter((t) => {
      const matchesTab = statuses.includes(t.status);
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        (t.requester?.displayName.toLowerCase().includes(q) ?? false) ||
        (t.createdBy?.name.toLowerCase().includes(q) ?? false) ||
        (t.assignee?.name.toLowerCase().includes(q) ?? false) ||
        (t.module?.name.toLowerCase().includes(q) ?? false);
      const matchesPriority =
        priorityFilter === "all" || t.priority === priorityFilter;
      const matchesModule =
        moduleFilter === "all" || t.module?.id === moduleFilter;
      const matchesSla =
        slaFilter === "all" || effectiveSlaStatus(t) === slaFilter;
      const matchesAssignment =
        assignmentFilter === "all" ||
        (assignmentFilter === "assigned"
          ? Boolean(t.assignee)
          : !t.assignee);
      return (
        matchesTab &&
        matchesSearch &&
        matchesPriority &&
        matchesModule &&
        matchesSla &&
        matchesAssignment
      );
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "oldest":
          return activityTime(a) - activityTime(b);
        case "priority":
          return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        case "sla":
          return SLA_RANK[effectiveSlaStatus(a)] - SLA_RANK[effectiveSlaStatus(b)];
        case "newest":
        default:
          return activityTime(b) - activityTime(a);
      }
    });
    return sorted;
  }, [
    tickets,
    tab,
    search,
    priorityFilter,
    moduleFilter,
    slaFilter,
    assignmentFilter,
    sortKey,
  ]);

  const counts = useMemo(
    () => {
      const acc = { inbox: 0, done: 0, inboxUnread: 0 };
      for (const t of tickets) {
        if (TAB_STATUS_SETS.inbox.has(t.status)) {
          acc.inbox++;
          if (t.isUnread) acc.inboxUnread++;
        } else if (TAB_STATUS_SETS.done.has(t.status)) acc.done++;
      }
      return acc;
    },
    [tickets],
  );

  function handleTabChange(value: Tab) {
    setQueryParam("tab", value, { replace: true });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const { createTicketAction } = await import("@/actions/tickets.actions");
      const result = await createTicketAction(formData);
      if (result?.error) {
        if (result.existingTicketId) {
          setSheetOpen(false);
          setQueryParam("selected", result.existingTicketId, { replace: true });
          return;
        }
        setFormError(result.error);
      } else {
        setSheetOpen(false);
        onTicketCreated?.();
        if (result.ticketId) {
          setQueryParam("selected", result.ticketId, { replace: true });
        }
      }
    });
  }

  return (
    <div className="flex min-h-0 w-80 md:w-96 flex-col border-r shrink-0 h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <h1 className="text-xl font-bold">Inbox</h1>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="size-8 p-0"
            title={
              soundEnabled
                ? "Bisukan notifikasi pesan baru"
                : "Aktifkan notifikasi pesan baru"
            }
            aria-label={
              soundEnabled
                ? "Bisukan notifikasi pesan baru"
                : "Aktifkan notifikasi pesan baru"
            }
          >
            {soundEnabled ? (
              <RiNotification3Line className="size-4" />
            ) : (
              <RiNotificationOffLine className="size-4 text-muted-foreground" />
            )}
          </Button>
          {configurationControl}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs">
                <RiAddLine className="size-3.5" /> Tiket Baru
              </Button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Buat Tiket Baru</SheetTitle>
              </SheetHeader>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4 px-1">
              <div className="space-y-1.5">
                <Label htmlFor="requesterName">Pelapor *</Label>
                <Input
                  id="requesterName"
                  name="requesterName"
                  placeholder="Nama pelapor..."
                  required
                  disabled={isPending}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="requesterEmail">Email</Label>
                  <Input
                    id="requesterEmail"
                    name="requesterEmail"
                    type="email"
                    placeholder="nama@rsud.local"
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="requesterPhone">WhatsApp</Label>
                  <Input
                    id="requesterPhone"
                    name="requesterPhone"
                    placeholder="628..."
                    disabled={isPending}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="title">Judul *</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="Deskripsi singkat masalah..."
                  required
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Deskripsi</Label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  placeholder="Detail lebih lengkap tentang masalah..."
                  disabled={isPending}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none disabled:opacity-50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="moduleId">Modul *</Label>
                <select
                  id="moduleId"
                  name="moduleId"
                  required
                  disabled={isPending}
                  defaultValue=""
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                >
                  <option value="" disabled>
                    Pilih modul...
                  </option>
                  {enabledModules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="priority">Prioritas *</Label>
                <select
                  id="priority"
                  name="priority"
                  required
                  disabled={isPending}
                  defaultValue="medium"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                >
                  <option value="low">Rendah</option>
                  <option value="medium">Normal</option>
                  <option value="critical">Kritis</option>
                </select>
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Membuat..." : "Buat Tiket"}
              </Button>
              </form>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <RiSearchLine className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari tiket, pelapor, modul..."
            className="pl-9 bg-muted/50 border-transparent focus-visible:bg-background h-9 rounded-md shadow-none"
          />
        </div>
      </div>

      {/* Filter + sort bar */}
      <div className="flex items-center gap-2 px-4 pb-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-8 flex-1 justify-start gap-1.5 text-xs"
            >
              <RiFilter3Line className="size-3.5" />
              Filter
              {activeFilterCount > 0 && (
                <span className="ml-auto inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Prioritas</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={priorityFilter}
              onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}
            >
              {(Object.keys(PRIORITY_FILTER_LABELS) as PriorityFilter[]).map((p) => (
                <DropdownMenuRadioItem key={p} value={p}>
                  {PRIORITY_FILTER_LABELS[p]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Modul</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={moduleFilter} onValueChange={setModuleFilter}>
              <DropdownMenuRadioItem value="all">Semua modul</DropdownMenuRadioItem>
              {enabledModules.map((m) => (
                <DropdownMenuRadioItem key={m.id} value={m.id}>
                  {m.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>SLA</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={slaFilter}
              onValueChange={(v) => setSlaFilter(v as SlaFilter)}
            >
              {(Object.keys(SLA_FILTER_LABELS) as SlaFilter[]).map((s) => (
                <DropdownMenuRadioItem key={s} value={s}>
                  {SLA_FILTER_LABELS[s]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Penugasan</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={assignmentFilter}
              onValueChange={(v) => setAssignmentFilter(v as AssignmentFilter)}
            >
              {(Object.keys(ASSIGNMENT_FILTER_LABELS) as AssignmentFilter[]).map((a) => (
                <DropdownMenuRadioItem key={a} value={a}>
                  {ASSIGNMENT_FILTER_LABELS[a]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            {activeFilterCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    resetFilters();
                  }}
                >
                  <RiCloseLine className="size-4" />
                  Reset filter
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-8 flex-1 justify-start gap-1.5 text-xs"
            >
              <RiArrowUpDownLine className="size-3.5" />
              <span className="truncate">{SORT_LABELS[sortKey]}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Urutkan</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sortKey}
              onValueChange={(v) => setSortKey(v as SortKey)}
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((s) => (
                <DropdownMenuRadioItem key={s} value={s}>
                  {SORT_LABELS[s]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tab bar */}
      <div className="px-4 border-b">
        <div className="flex gap-4">
          {(["inbox", "done"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={cn(
                "border-b-2 pb-3 pt-2 px-1 text-sm font-medium transition-colors whitespace-nowrap",
                tab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {TAB_LABELS[t]}{" "}
              {counts[t] > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">
                  {counts[t]}
                </span>
              )}
              {t === "inbox" && counts.inboxUnread > 0 && (
                <span
                  className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
                  aria-label={`${counts.inboxUnread} belum dibaca`}
                >
                  {counts.inboxUnread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filteredTickets.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {search || activeFilterCount > 0
              ? "Tidak ada tiket yang cocok."
              : `Tidak ada tiket ${TAB_LABELS[tab].toLowerCase()}.`}
          </div>
        ) : tab === "done" ? (
          // Split the done tab so closed (archival) tickets read as their own
          // group at the bottom instead of being mixed into resolved.
          <>
            {(["resolved", "closed"] as const).map((status) => {
              const group = filteredTickets.filter((t) => t.status === status);
              if (group.length === 0) return null;
              return (
                <div key={status}>
                  <ListSectionHeader
                    label={status === "resolved" ? "Selesai" : "Ditutup"}
                    count={group.length}
                  />
                  {group.map((ticket) => (
                    <TicketListItem
                      key={ticket.id}
                      ticket={ticket}
                      isSelected={ticket.id === selectedId}
                    />
                  ))}
                </div>
              );
            })}
          </>
        ) : (
          filteredTickets.map((ticket) => (
            <TicketListItem
              key={ticket.id}
              ticket={ticket}
              isSelected={ticket.id === selectedId}
            />
          ))
        )}
      </div>
    </div>
  );
}
