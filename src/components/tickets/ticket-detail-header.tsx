"use client";

import { RiInboxLine, RiUserLine, RiCheckLine, RiArrowRightUpLine, RiUserAddLine } from "@remixicon/react";
import { TicketSLABadge } from "./ticket-sla-badge";
import { TicketDetailData } from "./ticket-detail";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { resolveTicketAction, updateTicketStatusAction } from "@/actions/tickets.actions";
import { escalateTicketAction } from "@/actions/escalations.actions";
import { Badge } from "@/components/ui/badge";
import { Label } from "../ui/label";

const STATUS_LABEL: Record<string, string> = {
  open: "Terbuka",
  in_progress: "Sedang Dikerjakan",
  waiting: "Menunggu",
  resolved: "Selesai",
  closed: "Ditutup",
};

const STATUS_STYLE: Record<string, string> = {
  open: "bg-blue-50 text-blue-700 border-blue-200/50",
  in_progress: "bg-purple-50 text-purple-700 border-purple-200/50",
  waiting: "bg-orange-50 text-orange-700 border-orange-200/50",
  resolved: "bg-green-50 text-green-700 border-green-200/50",
  closed: "bg-gray-50 text-gray-600 border-gray-200/50",
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "Rendah",
  medium: "Sedang",
  critical: "Kritis",
};

const PRIORITY_STYLE: Record<string, string> = {
  low: "text-blue-600 bg-blue-50 border-blue-200/50",
  medium: "text-orange-600 bg-orange-50 border-orange-200/50",
  critical: "text-red-600 bg-red-50 border-red-200/50",
};

const SOURCE_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  web: "Web",
  email: "Email",
  manual: "Manual",
};

function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

interface TicketDetailHeaderProps {
  ticket: TicketDetailData;
  engineers?: { id: string; name: string; email: string }[];
  onMutated?: () => void;
}

export function TicketDetailHeader({ ticket, engineers = [], onMutated }: TicketDetailHeaderProps) {
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [isEscalateOpen, setIsEscalateOpen] = useState(false);
  const [selectedEngineerId, setSelectedEngineerId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [escalationReason, setEscalationReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [kbArticles, setKbArticles] = useState<{ id: string; title: string }[]>([]);
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([]);

  const shortId = `#${ticket.id.slice(0, 8).toUpperCase()}`;

  async function handleAssign(assigneeId: string | null) {
    setIsLoading(true);
    try {
      const { assignTicketAction } = await import("@/actions/tickets.actions");
      await assignTicketAction(ticket.id, assigneeId);
      onMutated?.();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResolveOpenChange(open: boolean) {
    setIsResolveOpen(open);
    if (open && kbArticles.length === 0) {
      try {
        const { getAllKbArticlesAction } = await import("@/actions/knowledge.actions");
        const articles = await getAllKbArticlesAction();
        setKbArticles(articles);
      } catch (error) {
        console.error("Failed to load KB articles", error);
      }
    }
  }

  async function handleResolve() {
    setIsLoading(true);
    try {
      await resolveTicketAction(ticket.id, {
        resolutionNote,
        resolvedKbIds: selectedKbIds.length > 0 ? selectedKbIds : undefined,
      });
      setIsResolveOpen(false);
      setResolutionNote("");
      setSelectedKbIds([]);
      onMutated?.();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEscalate() {
    setIsLoading(true);
    try {
      await escalateTicketAction({
        ticketId: ticket.id,
        engineerId: selectedEngineerId,
        reason: escalationReason,
      });
      setIsEscalateOpen(false);
      setEscalationReason("");
      setSelectedEngineerId(null);
      onMutated?.();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="sticky top-0 bg-background border-b z-10 p-6 pb-4">
      <div className="max-w-4xl mx-auto flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <span className="font-medium text-foreground/70">{shortId}</span>
            <span>•</span>
            <span>{ticket.module?.name ?? "Tidak ada modul"}</span>
            <span>•</span>
            <span>{formatTime(ticket.createdAt)}</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{ticket.title}</h2>
          <div className="flex items-center gap-2 pt-3 text-xs flex-wrap">
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium border ${STATUS_STYLE[ticket.status]}`}
            >
              <span className="size-1.5 rounded-full bg-current opacity-60 inline-block" />
              {STATUS_LABEL[ticket.status]}
            </span>
            <span className={`font-medium px-2 py-1 rounded border ${PRIORITY_STYLE[ticket.priority]}`}>
              {PRIORITY_LABEL[ticket.priority]}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <RiInboxLine className="size-3.5" />
              {SOURCE_LABEL[ticket.source]}
            </span>
            {ticket.createdBy && (
              <span className="text-muted-foreground flex items-center gap-1.5">
                <RiUserLine className="size-3.5" />
                {ticket.createdBy.name}
              </span>
            )}
            <TicketSLABadge
              slaDeadlineAt={ticket.slaDeadlineAt}
              slaStatus={ticket.slaStatus}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Assignment Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="size-9">
                <RiUserAddLine className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Tugaskan Ke</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleAssign(null)}>Lepas Tugas</DropdownMenuItem>
              <DropdownMenuSeparator />
              {engineers.length === 0 ? (
                <div className="p-2 text-xs text-muted-foreground">Tidak ada engineer tersedia</div>
              ) : (
                engineers.map((eng) => (
                  <DropdownMenuItem key={eng.id} onClick={() => handleAssign(eng.id)}>
                    {eng.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Escalation Dialog */}
          <Dialog open={isEscalateOpen} onOpenChange={setIsEscalateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-1.5">
                <RiArrowRightUpLine className="size-4" />
                Eskalasi
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Eskalasi Tiket</DialogTitle>
                <DialogDescription>
                  Gunakan ini jika tiket membutuhkan bantuan dari tim engineer khusus.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="engineer" className="text-sm font-medium">Pilih Engineer (Opsional)</Label>
                  <select
                    id="engineer"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    value={selectedEngineerId || ""}
                    onChange={(e) => setSelectedEngineerId(e.target.value || null)}
                  >
                    <option value="">-- Pilih Engineer --</option>
                    {engineers.map((eng) => (
                      <option key={eng.id} value={eng.id}>{eng.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason" className="text-sm font-medium">Alasan Eskalasi</Label>
                  <Textarea
                    id="reason"
                    placeholder="Alasan eskalasi..."
                    value={escalationReason}
                    onChange={(e) => setEscalationReason(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEscalateOpen(false)}>Batal</Button>
                <Button onClick={handleEscalate} disabled={isLoading || !escalationReason}>
                  {isLoading ? "Memproses..." : "Eskalasi"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Resolve Dialog */}
          <Dialog open={isResolveOpen} onOpenChange={handleResolveOpenChange}>
            <DialogTrigger asChild>
              <Button variant="default" className="bg-yellow-400 text-yellow-950 hover:bg-yellow-500 gap-1.5 border-0">
                <RiCheckLine className="size-4" /> Selesai
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Selesaikan Tiket</DialogTitle>
                <DialogDescription>
                  Berikan catatan penyelesaian agar reporter tahu apa yang sudah dilakukan.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resolutionNote" className="text-sm font-medium">Catatan Penyelesaian</Label>
                  <Textarea
                    id="resolutionNote"
                    placeholder="Catatan penyelesaian..."
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Artikel Knowledge Base yang Membantu (Opsional)</Label>
                  <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                    {kbArticles.length === 0 ? (
                      <div className="text-xs text-muted-foreground p-2">Memuat atau tidak ada artikel...</div>
                    ) : (
                      kbArticles.map((kb) => (
                        <div key={kb.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`kb-${kb.id}`}
                            className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                            checked={selectedKbIds.includes(kb.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedKbIds((prev) => [...prev, kb.id]);
                              } else {
                                setSelectedKbIds((prev) => prev.filter((id) => id !== kb.id));
                              }
                            }}
                          />
                          <label htmlFor={`kb-${kb.id}`} className="text-sm cursor-pointer">
                            {kb.title}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsResolveOpen(false)}>Batal</Button>
                <Button onClick={handleResolve} disabled={isLoading || !resolutionNote}>
                  {isLoading ? "Memproses..." : "Selesaikan"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
