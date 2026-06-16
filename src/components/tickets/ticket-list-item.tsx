"use client";

import {
  RiCheckboxCircleLine,
  RiCircleLine,
  RiInboxLine,
  RiProgress3Line,
  RiUserLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { TicketSLABadge } from "./ticket-sla-badge";
import { useQueryParams } from "@/hooks/use-query-params";

export type TicketListEntry = {
  id: string;
  title: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "critical";
  slaStatus: "safe" | "warning" | "breached";
  slaDeadlineAt: Date | string | null;
  firstResponseSlaStatus?: "safe" | "warning" | "breached";
  firstResponseDueAt?: Date | string | null;
  firstRespondedAt?: Date | string | null;
  resolutionSlaStatus?: "safe" | "warning" | "breached";
  resolutionDueAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  createdAt: Date | string;
  module: { id: string; name: string; color: string | null } | null;
  requester: { id: string; displayName: string; fullName: string | null } | null;
  createdBy: { id: string; name: string } | null;
  assignee: { id: string; name: string } | null;
};

const PRIORITY_STYLE: Record<TicketListEntry["priority"], string> = {
  low: "border-blue-200/70 bg-blue-50 text-blue-700",
  medium: "border-orange-200/70 bg-orange-50 text-orange-700",
  critical: "border-red-200/70 bg-red-50 text-red-700",
};

const PRIORITY_LABEL: Record<TicketListEntry["priority"], string> = {
  low: "Rendah",
  medium: "Normal",
  critical: "Kritis",
};

const STATUS_LABEL: Record<TicketListEntry["status"], string> = {
  open: "Terbuka",
  in_progress: "Dikerjakan",
  resolved: "Selesai",
  closed: "Ditutup",
};

const STATUS_STYLE: Record<TicketListEntry["status"], string> = {
  open: "border-sky-200/70 bg-sky-50 text-sky-700",
  in_progress: "border-violet-200/70 bg-violet-50 text-violet-700",
  resolved: "border-emerald-200/70 bg-emerald-50 text-emerald-700",
  closed: "border-slate-200/70 bg-slate-50 text-slate-600",
};

const STATUS_ICON = {
  open: RiCircleLine,
  in_progress: RiProgress3Line,
  resolved: RiCheckboxCircleLine,
  closed: RiCheckboxCircleLine,
} satisfies Record<TicketListEntry["status"], typeof RiCircleLine>;

function timeAgo(date: Date | string): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins} m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} j`;
  return `${Math.floor(hours / 24)} h`;
}

interface TicketListItemProps {
  ticket: TicketListEntry;
  isSelected: boolean;
}

export function TicketListItem({ ticket, isSelected }: TicketListItemProps) {
  const { setQueryParam } = useQueryParams();
  const StatusIcon = STATUS_ICON[ticket.status];

  const handleClick = () => {
    setQueryParam("selected", ticket.id, { replace: true });
  };

  const shortId = `#${ticket.id.slice(0, 8).toUpperCase()}`;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        "border-b border-l-4 p-4 cursor-pointer transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected
          ? "border-l-primary bg-muted/25"
          : "border-l-transparent",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {shortId}
            <RiInboxLine className="size-3.5" />
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4",
              STATUS_STYLE[ticket.status],
            )}
          >
            <StatusIcon className="size-3 shrink-0" />
            {STATUS_LABEL[ticket.status]}
          </span>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {timeAgo(ticket.createdAt)}
        </span>
      </div>

      <h3 className="mb-3 line-clamp-2 pr-2 text-sm font-semibold leading-snug">
        {ticket.title}
      </h3>

      <div className="mb-3 flex min-w-0 items-center justify-between gap-2 text-xs">
        <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <RiUserLine className="size-3.5 shrink-0" />
          <span className="truncate">
            {ticket.requester?.displayName ?? ticket.createdBy?.name ?? "Anonim"}
          </span>
        </div>
        <div className="flex min-w-0 shrink-0 items-center gap-1.5">
          {ticket.module && (
            <span className="flex max-w-28 items-center gap-1.5 truncate font-medium">
              <span
                className="inline-block size-2 shrink-0 rounded-sm"
                style={{ backgroundColor: ticket.module.color ?? "#94a3b8" }}
              />
              <span className="truncate">{ticket.module.name}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span
          className={cn(
            "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium leading-4",
            PRIORITY_STYLE[ticket.priority],
          )}
        >
          {PRIORITY_LABEL[ticket.priority]}
        </span>
        <span
          className={cn(
            "inline-flex min-w-0 max-w-full items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium leading-4",
            ticket.assignee
              ? "border-border bg-background text-foreground"
              : "border-dashed border-border bg-muted/30 text-muted-foreground",
          )}
        >
          <RiUserLine className="size-3 shrink-0" />
          <span className="truncate">
            {ticket.assignee?.name ?? "Belum ditugaskan"}
          </span>
        </span>
        <TicketSLABadge
          label="Respons"
          slaDeadlineAt={ticket.firstResponseDueAt ?? null}
          slaStatus={ticket.firstResponseSlaStatus ?? "safe"}
          completedAt={ticket.firstRespondedAt}
          className="max-w-full"
        />
        <TicketSLABadge
          label="Resolusi"
          slaDeadlineAt={ticket.resolutionDueAt ?? ticket.slaDeadlineAt}
          slaStatus={ticket.resolutionSlaStatus ?? ticket.slaStatus}
          completedAt={ticket.resolvedAt}
          className="max-w-full"
        />
      </div>
    </div>
  );
}
