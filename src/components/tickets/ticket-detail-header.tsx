"use client";

import {
  RiArrowRightUpLine,
  RiCheckLine,
  RiInboxLine,
  RiMoreLine,
  RiRouteLine,
  RiSparklingLine,
  RiUserLine,
} from "@remixicon/react";
import { TicketSLABadge } from "./ticket-sla-badge";
import { TicketTriageBadge } from "./ticket-triage-badge";
import { useTicketEvents } from "./ticket-events-context";
import { TicketDetailData } from "./ticket-detail";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { Label } from "../ui/label";
import { formatTime } from "@/lib/utils";
import type { TicketConfiguration } from "@/lib/tickets/ticket-configuration";
import { InlinePicker } from "./ticket-inline-picker";
import { useTicketDetailMutation } from "@/hooks/use-ticket-detail-mutation";
import { toast } from "sonner";


const STATUS_LABEL: Record<string, string> = {
  open: "Terbuka",
  in_progress: "Dikerjakan",
  resolved: "Selesai",
  closed: "Ditutup",
};

const STATUS_STYLE: Record<string, string> = {
  open: "bg-blue-50 text-blue-700 border-blue-200/50",
  in_progress: "bg-purple-50 text-purple-700 border-purple-200/50",
  resolved: "bg-green-50 text-green-700 border-green-200/50",
  closed: "bg-gray-50 text-gray-600 border-gray-200/50",
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "Rendah",
  medium: "Normal",
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
  api: "API",
};

// Stable empty-array default so omitted list props keep a constant reference
// across renders instead of allocating a new array each time.
const EMPTY_ARRAY: never[] = [];

interface TicketDetailHeaderProps {
  ticket: TicketDetailData;
  modules?: { id: string; name: string; color: string | null; slug?: string }[];
  configuration?: TicketConfiguration;
  assignableStaff?: { id: string; name: string; email: string; role: string }[];
  isRequesterPanelOpen?: boolean;
  onToggleRequesterPanel?: () => void;
  isCopilotOpen?: boolean;
  onToggleCopilot?: () => void;
  onMutated?: () => void;
}

export function TicketDetailHeader({
  ticket,
  modules = EMPTY_ARRAY,
  configuration,
  assignableStaff = EMPTY_ARRAY,
  isRequesterPanelOpen = false,
  onToggleRequesterPanel,
  isCopilotOpen = false,
  onToggleCopilot,
  onMutated,
}: TicketDetailHeaderProps) {
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [isEscalateOpen, setIsEscalateOpen] = useState(false);
  const [isConfigureOpen, setIsConfigureOpen] = useState(false);
  const [selectedEngineerId, setSelectedEngineerId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(ticket.module?.id ?? null);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(ticket.assignee?.id ?? null);
  const [selectedPriority, setSelectedPriority] = useState<TicketDetailData["priority"]>(ticket.priority);
  const [resolutionNote, setResolutionNote] = useState("");
  const [escalationReason, setEscalationReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [kbArticles, setKbArticles] = useState<{ id: string; title: string }[]>([]);
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([]);

  const shortId = `#${ticket.id.slice(0, 8).toUpperCase()}`;
  const isClosed = ticket.status === "closed";
  const isResolved = ticket.status === "resolved";
  const canEditActiveMetadata = !isClosed && !isResolved;
  const requesterName = ticket.requester?.displayName ?? ticket.createdBy?.name ?? "Tanpa pelapor";
  const requesterDetail =
    ticket.requester?.department?.name ??
    ticket.requester?.primaryPhone ??
    ticket.requester?.primaryEmail ??
    "Belum ada detail kontak";
  const hasResponseSla = Boolean(ticket.firstResponseDueAt);
  const hasResolutionSla = Boolean(ticket.resolutionDueAt ?? ticket.slaDeadlineAt);
  const enabledModules =
    configuration?.enabledModuleIds && configuration.enabledModuleIds.length > 0
      ? modules.filter((module) => configuration.enabledModuleIds.includes(module.id))
      : modules;

  const { optimisticUpdate } = useTicketDetailMutation(ticket.id);
  const { triagingIds } = useTicketEvents();

  type ConfigurePatch = {
    moduleId?: string | null;
    assigneeId?: string | null;
    priority?: TicketDetailData["priority"];
  };

  /** Mirrors configureTicketCommand's effect on the detail shape, locally. */
  function applyConfigurePatch(
    current: TicketDetailData,
    patch: ConfigurePatch,
  ): TicketDetailData {
    const next = { ...current };

    if (patch.moduleId !== undefined) {
      const module = enabledModules.find((m) => m.id === patch.moduleId);
      next.module =
        patch.moduleId && module
          ? { id: module.id, name: module.name, color: module.color ?? null }
          : null;
    }

    if (patch.assigneeId !== undefined) {
      const staff = assignableStaff.find((s) => s.id === patch.assigneeId);
      next.assignee =
        patch.assigneeId && staff ? { id: staff.id, name: staff.name } : null;
    }

    if (patch.priority) next.priority = patch.priority;

    // Routing changes also move the status (same rule as the server command).
    if (patch.moduleId !== undefined || patch.assigneeId !== undefined) {
      const toAssigneeId =
        patch.assigneeId !== undefined ? patch.assigneeId : current.assignee?.id ?? null;
      next.status = toAssigneeId ? "in_progress" : "open";
    }

    return next;
  }

  async function runConfigureAction(patch: ConfigurePatch) {
    const { configureTicketAction } = await import("@/actions/tickets.actions");
    const result = await configureTicketAction(ticket.id, patch);
    if (result?.error) throw new Error(result.error);
  }

  function openConfigureDialog() {
    setSelectedModuleId(ticket.module?.id ?? null);
    setSelectedAssigneeId(
      configuration?.moduleChangeClearsAssignee ? null : ticket.assignee?.id ?? null,
    );
    setSelectedPriority(ticket.priority);
    setIsConfigureOpen(true);
  }

  async function handleSaveConfiguration() {
    const patch: ConfigurePatch = {
      moduleId: selectedModuleId,
      assigneeId: selectedAssigneeId,
      priority: selectedPriority,
    };
    setIsConfigureOpen(false);
    setIsLoading(true);
    try {
      await optimisticUpdate(
        (current) => applyConfigurePatch(current, patch),
        () => runConfigureAction(patch),
      );
      onMutated?.();
    } catch (error) {
      console.error(error);
      toast.error("Gagal menyimpan rute tiket.");
    } finally {
      setIsLoading(false);
    }
  }

  /** Saves a single metadata field from an inline picker (no dialog). */
  async function handleInlineConfigure(patch: ConfigurePatch) {
    setIsLoading(true);
    try {
      await optimisticUpdate(
        (current) => applyConfigurePatch(current, patch),
        () => runConfigureAction(patch),
      );
      onMutated?.();
    } catch (error) {
      console.error(error);
      toast.error("Gagal menyimpan perubahan tiket.");
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
    const note = resolutionNote;
    const kbIds = selectedKbIds;
    setIsResolveOpen(false);
    setIsLoading(true);
    try {
      await optimisticUpdate(
        (current) => ({
          ...current,
          status: "resolved",
          resolvedAt: new Date().toISOString(),
        }),
        async () => {
          const { resolveTicketAction } = await import("@/actions/tickets.actions");
          const result = await resolveTicketAction(ticket.id, {
            resolutionNote: note,
            resolvedKbIds: kbIds.length > 0 ? kbIds : undefined,
          });
          if (result?.error) throw new Error(result.error);
        },
      );
      setResolutionNote("");
      setSelectedKbIds([]);
      onMutated?.();
    } catch (error) {
      console.error(error);
      // Note and KB selection are kept so reopening the dialog restores them.
      setIsResolveOpen(true);
      toast.error("Gagal menyelesaikan tiket.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEscalate() {
    setIsLoading(true);
    try {
      const { escalateTicketAction } = await import("@/actions/escalations.actions");
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

  async function handleReopen() {
    setIsLoading(true);
    try {
      await optimisticUpdate(
        (current) => ({
          ...current,
          status: current.assignee ? "in_progress" : "open",
          resolvedAt: null,
        }),
        async () => {
          const { reopenTicketAction } = await import("@/actions/tickets.actions");
          const result = await reopenTicketAction(ticket.id);
          if (result?.error) throw new Error(result.error);
        },
      );
      onMutated?.();
    } catch (error) {
      console.error(error);
      toast.error("Gagal membuka ulang tiket.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleClose() {
    setIsLoading(true);
    try {
      await optimisticUpdate(
        (current) => ({ ...current, status: "closed" }),
        async () => {
          const { closeTicketAction } = await import("@/actions/tickets.actions");
          const result = await closeTicketAction(ticket.id);
          if (result?.error) throw new Error(result.error);
        },
      );
      onMutated?.();
    } catch (error) {
      console.error(error);
      toast.error("Gagal menutup tiket.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="sticky top-0 z-10 border-b bg-background">
      <div className="flex w-full flex-col gap-2.5 px-8 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground/75">{shortId}</span>
              <span className="text-border">/</span>
              <span className="flex items-center gap-1.5">
                <RiInboxLine className="size-3.5" />
                {SOURCE_LABEL[ticket.source]}
              </span>
              <span className="text-border">/</span>
              <span>{formatTime(ticket.createdAt)}</span>
              <TicketTriageBadge
                status={ticket.triageStatus}
                isTriaging={triagingIds.has(ticket.id)}
              />
            </div>
            <h2 className="max-w-3xl break-words text-xl font-bold leading-tight tracking-tight">
              {ticket.title}
            </h2>
          </div>

          {/* Two clusters with distinct mental models, separated by a divider:
              workflow actions (change the ticket) on the left, panel toggles
              (change the layout) pinned to the right edge. */}
          <TooltipProvider>
            <div className="flex shrink-0 items-center gap-2">
              {canEditActiveMetadata && (
                <>
                  <Button variant="outline" className="gap-1.5" onClick={openConfigureDialog}>
                    <RiRouteLine className="size-4" />
                    Rute
                  </Button>

                  <Button
                    variant="default"
                    className="gap-1.5 border-0 bg-yellow-400 text-yellow-950 hover:bg-yellow-500"
                    onClick={() => handleResolveOpenChange(true)}
                  >
                    <RiCheckLine className="size-4" /> Selesai
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        aria-label="Aksi lainnya"
                      >
                        <RiMoreLine className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setIsEscalateOpen(true)}>
                        <RiArrowRightUpLine className="size-4" />
                        Eskalasi bantuan…
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}

              {isResolved && (
                <>
                  <Button variant="outline" onClick={handleReopen} disabled={isLoading}>
                    Buka Ulang
                  </Button>
                  <Button variant="default" onClick={handleClose} disabled={isLoading}>
                    Tutup
                  </Button>
                </>
              )}

              <Separator orientation="vertical" className="mx-1 h-6" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isCopilotOpen ? "secondary" : "ghost"}
                    size="icon"
                    className="size-9"
                    onClick={onToggleCopilot}
                    aria-label="AI Copilot"
                    aria-pressed={isCopilotOpen}
                  >
                    <RiSparklingLine className="size-4 text-amber-600 dark:text-amber-400" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>AI Copilot</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isRequesterPanelOpen ? "secondary" : "ghost"}
                    size="icon"
                    className="size-9"
                    onClick={onToggleRequesterPanel}
                    aria-label="Profil pelapor"
                    aria-pressed={isRequesterPanelOpen}
                  >
                    <RiUserLine className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Profil pelapor</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[ticket.status]}`}
            >
              <span className="inline-block size-1.5 rounded-full bg-current opacity-60" />
              {STATUS_LABEL[ticket.status]}
            </span>
            {canEditActiveMetadata ? (
              <InlinePicker
                options={[
                  { value: "low", label: "Rendah" },
                  { value: "medium", label: "Normal" },
                  { value: "critical", label: "Kritis" },
                ]}
                value={ticket.priority}
                searchable={false}
                disabled={isLoading}
                onSelect={(next) => {
                  if (next) {
                    handleInlineConfigure({
                      priority: next as TicketDetailData["priority"],
                    });
                  }
                }}
              >
                <button
                  type="button"
                  title="Ubah prioritas"
                  className={`inline-flex cursor-pointer rounded border px-2.5 py-1 text-xs font-medium transition-shadow hover:ring-2 hover:ring-ring/30 ${PRIORITY_STYLE[ticket.priority]}`}
                >
                  {PRIORITY_LABEL[ticket.priority]}
                </button>
              </InlinePicker>
            ) : (
              <span
                className={`inline-flex rounded border px-2.5 py-1 text-xs font-medium ${PRIORITY_STYLE[ticket.priority]}`}
              >
                {PRIORITY_LABEL[ticket.priority]}
              </span>
            )}
          </div>

          <span className="hidden h-5 w-px bg-border lg:block" />

          <div className="flex min-w-0 items-center gap-1.5">
            <RiUserLine className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="max-w-36 truncate font-medium text-foreground">
              {requesterName}
            </span>
            <span className="max-w-32 truncate text-muted-foreground">
              {requesterDetail}
            </span>
          </div>

          <span className="hidden h-5 w-px bg-border lg:block" />

          {/* Module and assignee edit in place — each value is its own picker. */}
          {canEditActiveMetadata ? (
            <div className="flex min-w-0 items-center gap-1">
              <InlinePicker
                options={[
                  { value: null, label: "Tidak ada modul", color: null },
                  ...enabledModules.map((module) => ({
                    value: module.id,
                    label: module.name,
                    color: module.color,
                  })),
                ]}
                value={ticket.module?.id ?? null}
                searchPlaceholder="Cari modul…"
                disabled={isLoading}
                onSelect={(next) =>
                  handleInlineConfigure({
                    moduleId: next,
                    ...(configuration?.moduleChangeClearsAssignee
                      ? { assigneeId: null }
                      : {}),
                  })
                }
              >
                <button
                  type="button"
                  title="Ubah modul"
                  className="flex min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted"
                >
                  {ticket.module?.color && (
                    <span
                      className="size-2 shrink-0 rounded-sm"
                      style={{ backgroundColor: ticket.module.color }}
                    />
                  )}
                  <span className="max-w-36 truncate font-medium text-foreground">
                    {ticket.module?.name ?? "Tidak ada modul"}
                  </span>
                </button>
              </InlinePicker>

              <InlinePicker
                options={[
                  { value: null, label: "Antrian modul", description: "tanpa penanggung jawab" },
                  ...assignableStaff.map((staff) => ({
                    value: staff.id,
                    label: staff.name,
                    description: staff.role,
                  })),
                ]}
                value={ticket.assignee?.id ?? null}
                searchPlaceholder="Cari staf…"
                disabled={isLoading}
                onSelect={(next) => handleInlineConfigure({ assigneeId: next })}
              >
                <button
                  type="button"
                  title="Ubah penanggung jawab"
                  className="flex min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted"
                >
                  <span className="max-w-32 truncate text-muted-foreground">
                    {ticket.assignee?.name ?? "Belum ditugaskan"}
                  </span>
                </button>
              </InlinePicker>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-1.5">
              {ticket.module?.color && (
                <span
                  className="size-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: ticket.module.color }}
                />
              )}
              <span className="max-w-36 truncate font-medium text-foreground">
                {ticket.module?.name ?? "Tidak ada modul"}
              </span>
              <span className="max-w-32 truncate text-muted-foreground">
                {ticket.assignee?.name ?? "Belum ditugaskan"}
              </span>
            </div>
          )}

          <span className="hidden h-5 w-px bg-border xl:block" />

          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {hasResponseSla || hasResolutionSla ? (
              <>
                {hasResponseSla && (
                  <TicketSLABadge
                    label="Respons"
                    slaDeadlineAt={ticket.firstResponseDueAt ?? null}
                    slaStatus={ticket.firstResponseSlaStatus ?? "safe"}
                    completedAt={ticket.firstRespondedAt}
                  />
                )}
                {hasResolutionSla && (
                  <TicketSLABadge
                    label="Resolusi"
                    slaDeadlineAt={ticket.resolutionDueAt ?? ticket.slaDeadlineAt}
                    slaStatus={ticket.resolutionSlaStatus ?? ticket.slaStatus}
                    completedAt={ticket.resolvedAt}
                  />
                )}
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Tidak ada SLA</span>
            )}
          </div>
        </div>
      </div>

      {/* Rute dialog */}
      <Dialog open={isConfigureOpen} onOpenChange={setIsConfigureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rute Tiket</DialogTitle>
            <DialogDescription>
              Tentukan modul, penanggung jawab, dan prioritas operasional tiket ini.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticket-module" className="text-sm font-medium">Modul</Label>
              <select
                id="ticket-module"
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={selectedModuleId ?? ""}
                onChange={(event) => {
                  setSelectedModuleId(event.target.value || null);
                  if (configuration?.moduleChangeClearsAssignee) {
                    setSelectedAssigneeId(null);
                  }
                }}
              >
                <option value="">-- Tidak ada modul --</option>
                {enabledModules.map((module) => (
                  <option key={module.id} value={module.id}>{module.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-assignee" className="text-sm font-medium">Ditangani oleh</Label>
              <select
                id="ticket-assignee"
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={selectedAssigneeId ?? ""}
                onChange={(event) => setSelectedAssigneeId(event.target.value || null)}
              >
                <option value="">-- Antrian modul --</option>
                {assignableStaff.map((staff) => (
                  <option key={staff.id} value={staff.id}>{staff.name}</option>
                ))}
              </select>
              {configuration?.moduleChangeClearsAssignee && (
                <p className="text-xs text-muted-foreground">
                  Mengubah modul akan mengembalikan tiket ke antrian modul kecuali penanggung jawab baru dipilih.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-priority" className="text-sm font-medium">Prioritas</Label>
              <select
                id="ticket-priority"
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={selectedPriority}
                onChange={(event) => setSelectedPriority(event.target.value as TicketDetailData["priority"])}
              >
                <option value="low">Rendah</option>
                <option value="medium">Normal</option>
                <option value="critical">Kritis</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigureOpen(false)}>Batal</Button>
            <Button onClick={handleSaveConfiguration} disabled={isLoading}>
              {isLoading ? "Menyimpan..." : "Simpan Rute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eskalasi dialog */}
      <Dialog open={isEscalateOpen} onOpenChange={setIsEscalateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eskalasi Bantuan</DialogTitle>
            <DialogDescription>
              Minta bantuan tambahan tanpa mengubah rute utama tiket. Gunakan saat kasus perlu perhatian teknis atau keputusan lanjutan.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="engineer" className="text-sm font-medium">Minta bantuan dari (opsional)</Label>
              <select
                id="engineer"
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={selectedEngineerId || ""}
                onChange={(e) => setSelectedEngineerId(e.target.value || null)}
              >
                <option value="">-- Tidak menunjuk orang tertentu --</option>
                {assignableStaff.map((staff) => (
                  <option key={staff.id} value={staff.id}>{staff.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Ini bukan pengganti penanggung jawab tiket. Ubah pemilik tiket dari Rute jika ownership perlu dipindahkan.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-medium">Alasan eskalasi</Label>
              <Textarea
                id="reason"
                placeholder="Jelaskan bantuan yang dibutuhkan dan konteks yang sudah dicek..."
                value={escalationReason}
                onChange={(e) => setEscalationReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEscalateOpen(false)}>Batal</Button>
            <Button onClick={handleEscalate} disabled={isLoading || !escalationReason}>
              {isLoading ? "Memproses..." : "Kirim Eskalasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Selesai dialog */}
      <Dialog open={isResolveOpen} onOpenChange={handleResolveOpenChange}>
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
  );
}
