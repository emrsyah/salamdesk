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
import { RiSearchLine, RiAddLine } from "@remixicon/react";
import { TicketListItem, type TicketListEntry } from "./ticket-list-item";
import { useQueryParams } from "@/hooks/use-query-params";

import { cn } from "@/lib/utils";

type Module = { id: string; name: string; color: string | null; slug: string };

interface TicketListProps {
  tickets: TicketListEntry[];
  modules: Module[];
  onTicketCreated?: () => void;
}

type Tab = "inbox" | "waiting" | "done";

const TAB_STATUSES: Record<Tab, TicketListEntry["status"][]> = {
  inbox: ["open", "in_progress"],
  waiting: ["waiting"],
  done: ["resolved", "closed"],
};

const TAB_LABELS: Record<Tab, string> = {
  inbox: "Inbox",
  waiting: "Menunggu",
  done: "Selesai",
};

export function TicketList({ tickets, modules, onTicketCreated }: TicketListProps) {
  const { searchParams, setQueryParam } = useQueryParams();
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const tab = (searchParams.get("tab") ?? "inbox") as Tab;
  const selectedId = searchParams.get("selected");

  const filteredTickets = useMemo(() => {
    const statuses = TAB_STATUSES[tab] ?? TAB_STATUSES.inbox;
    const q = search.toLowerCase();
    return tickets.filter((t) => {
      const matchesTab = statuses.includes(t.status);
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        (t.createdBy?.name.toLowerCase().includes(q) ?? false) ||
        (t.module?.name.toLowerCase().includes(q) ?? false);
      return matchesTab && matchesSearch;
    });
  }, [tickets, tab, search]);

  const counts = useMemo(
    () => {
      const acc = { inbox: 0, waiting: 0, done: 0 };
      for (const t of tickets) {
        if (TAB_STATUSES.inbox.includes(t.status)) acc.inbox++;
        else if (TAB_STATUSES.waiting.includes(t.status)) acc.waiting++;
        else if (TAB_STATUSES.done.includes(t.status)) acc.done++;
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
    <div className="flex w-80 md:w-96 flex-col border-r shrink-0 h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <h1 className="text-xl font-bold">Inbox</h1>
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
                  {modules.map((m) => (
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
                  <option value="medium">Sedang</option>
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

      {/* Tab bar */}
      <div className="px-4 border-b">
        <div className="flex gap-4">
          {(["inbox", "waiting", "done"] as Tab[]).map((t) => (
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
                <span
                  className={cn(
                    "ml-1 text-xs",
                    t === "waiting" && counts.waiting > 0
                      ? "text-orange-500 font-semibold"
                      : "text-muted-foreground",
                  )}
                >
                  {counts[t]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket list */}
      <div className="flex-1 overflow-y-auto">
        {filteredTickets.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {search ? "Tidak ada tiket yang cocok." : `Tidak ada tiket ${TAB_LABELS[tab].toLowerCase()}.`}
          </div>
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
