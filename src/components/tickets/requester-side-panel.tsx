"use client";

import { useEffect, useState, useTransition } from "react";
import { RiCloseLine, RiHistoryLine, RiSaveLine, RiUserLine } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { formatTime } from "@/lib/utils";

type Requester = {
  id: string;
  displayName: string;
  fullName: string | null;
  jobTitle?: string | null;
  employeeNumber?: string | null;
  primaryPhone: string | null;
  primaryEmail: string | null;
  externalRef?: string | null;
  notes?: string | null;
  department: { id: string; name: string } | null;
};

type RequesterTicketHistoryItem = {
  id: string;
  title: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "critical";
  source: "whatsapp" | "web" | "email" | "manual" | "api";
  createdAt: Date | string;
  resolvedAt: Date | string | null;
  closedAt: Date | string | null;
  module: { id: string; name: string; color: string | null } | null;
  assignee: { id: string; name: string } | null;
};

interface RequesterSidePanelProps {
  requester: Requester | null;
  currentTicketId: string;
  onClose: () => void;
  onRequesterUpdated?: () => void;
  onSelectTicket?: (ticketId: string) => void;
}

const STATUS_LABEL: Record<RequesterTicketHistoryItem["status"], string> = {
  open: "Terbuka",
  in_progress: "Dikerjakan",
  resolved: "Selesai",
  closed: "Ditutup",
};

function normalizeStatus(status: RequesterTicketHistoryItem["status"] | "waiting"): RequesterTicketHistoryItem["status"] {
  return status === "waiting" ? "in_progress" : status;
}

const PRIORITY_LABEL: Record<RequesterTicketHistoryItem["priority"], string> = {
  low: "Rendah",
  medium: "Normal",
  critical: "Kritis",
};

export function RequesterSidePanel({
  requester,
  currentTicketId,
  onClose,
  onRequesterUpdated,
  onSelectTicket,
}: RequesterSidePanelProps) {
  const [displayName, setDisplayName] = useState(requester?.displayName ?? "");
  const [fullName, setFullName] = useState(requester?.fullName ?? "");
  const [jobTitle, setJobTitle] = useState(requester?.jobTitle ?? "");
  const [employeeNumber, setEmployeeNumber] = useState(requester?.employeeNumber ?? "");
  const [primaryPhone, setPrimaryPhone] = useState(requester?.primaryPhone ?? "");
  const [primaryEmail, setPrimaryEmail] = useState(requester?.primaryEmail ?? "");
  const [externalRef, setExternalRef] = useState(requester?.externalRef ?? "");
  const [notes, setNotes] = useState(requester?.notes ?? "");
  const [history, setHistory] = useState<RequesterTicketHistoryItem[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!requester) return;

    let isActive = true;
    const requesterId = requester.id;
    async function loadHistory() {
      const { getRequesterTicketHistoryAction } = await import("@/actions/requesters.actions");
      const items = await getRequesterTicketHistoryAction(requesterId);
      if (isActive) {
        setHistory(items.map((item) => ({ ...item, status: normalizeStatus(item.status) })));
      }
    }

    loadHistory().catch((error) => {
      console.error("Failed to load requester ticket history", error);
    });

    return () => {
      isActive = false;
    };
  }, [requester]);

  function handleSave() {
    if (!requester) return;
    setFormError(null);
    startTransition(async () => {
      const { updateRequesterProfileAction } = await import("@/actions/requesters.actions");
      const result = await updateRequesterProfileAction(requester.id, {
        displayName,
        fullName,
        jobTitle,
        employeeNumber,
        primaryPhone,
        primaryEmail,
        externalRef,
        notes,
      });

      if (result?.error) {
        setFormError(result.error);
        return;
      }

      onRequesterUpdated?.();
    });
  }

  if (!requester) {
    return (
      <aside className="flex w-96 shrink-0 flex-col border-l bg-background">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="font-semibold">Profil Pelapor</h3>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <RiCloseLine className="size-4" />
          </Button>
        </div>
        <div className="p-4 text-sm text-muted-foreground">Tiket ini belum memiliki data pelapor.</div>
      </aside>
    );
  }

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l bg-background">
      <div className="flex items-center justify-between border-b p-4">
        <div className="min-w-0">
          <h3 className="font-semibold">Profil Pelapor</h3>
          <p className="truncate text-xs text-muted-foreground">{requester.department?.name ?? "Tanpa departemen"}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <RiCloseLine className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
              <RiUserLine className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{requester.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {requester.primaryEmail || requester.primaryPhone || requester.externalRef || requester.id}
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="requester-display-name">Nama tampilan</Label>
              <Input id="requester-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="requester-full-name">Nama lengkap</Label>
              <Input id="requester-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="requester-phone">Telepon</Label>
                <Input id="requester-phone" value={primaryPhone} onChange={(event) => setPrimaryPhone(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="requester-email">Email</Label>
                <Input id="requester-email" type="email" value={primaryEmail} onChange={(event) => setPrimaryEmail(event.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="requester-job-title">Jabatan</Label>
                <Input id="requester-job-title" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="requester-employee-number">NIP/ID Pegawai</Label>
                <Input id="requester-employee-number" value={employeeNumber} onChange={(event) => setEmployeeNumber(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="requester-external-ref">Referensi eksternal</Label>
              <Input id="requester-external-ref" value={externalRef} onChange={(event) => setExternalRef(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="requester-notes">Catatan</Label>
              <Textarea id="requester-notes" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <Button onClick={handleSave} disabled={isPending || !displayName.trim()} className="w-full">
              <RiSaveLine className="mr-2 size-4" />
              {isPending ? "Menyimpan..." : "Simpan Profil"}
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <RiHistoryLine className="size-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">Riwayat Tiket</h4>
              <Badge variant="outline">{history.length}</Badge>
            </div>
            <div className="space-y-2">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada riwayat tiket lain.</p>
              ) : (
                history.map((item) => {
                  const isCurrent = item.id === currentTicketId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => onSelectTicket?.(item.id)}
                      className="w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-default disabled:bg-muted/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
                        {isCurrent && <Badge variant="secondary">Saat ini</Badge>}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge variant="outline">{STATUS_LABEL[item.status]}</Badge>
                        <span>{PRIORITY_LABEL[item.priority]}</span>
                        <span>{item.module?.name ?? "Tanpa modul"}</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatTime(item.createdAt)}
                        {item.assignee ? ` - ${item.assignee.name}` : ""}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
