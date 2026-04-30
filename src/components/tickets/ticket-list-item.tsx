"use client";

import { RiInboxLine } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { TicketSLABadge } from "./ticket-sla-badge";
import { useQueryParams } from "@/hooks/use-query-params";

export type TicketListEntry = {
  id: string;
  title: string;
  status: "open" | "in_progress" | "waiting" | "resolved" | "closed";
  priority: "low" | "medium" | "critical";
  slaStatus: "safe" | "warning" | "breached";
  slaDeadlineAt: Date | string | null;
  createdAt: Date | string;
  module: { id: string; name: string; color: string | null } | null;
  createdBy: { id: string; name: string } | null;
};

const PRIORITY_STYLE: Record<TicketListEntry["priority"], string> = {
  low: "text-blue-600",
  medium: "text-orange-500",
  critical: "text-red-500 font-semibold",
};

const PRIORITY_LABEL: Record<TicketListEntry["priority"], string> = {
  low: "Rendah",
  medium: "Sedang",
  critical: "Kritis",
};

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

  const handleClick = () => {
    setQueryParam("selected", ticket.id, { replace: true });
  };

  const shortId = `#${ticket.id.slice(0, 8).toUpperCase()}`;

  return (
    <div
      onClick={handleClick}
      className={cn(
        "p-4 border-b cursor-pointer transition-colors hover:bg-muted/50 border-l-4",
        isSelected
          ? "border-l-primary bg-muted/20"
          : "border-l-transparent",
      )}
    >
      <div className="flex justify-between items-start mb-1.5">
        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          {shortId} <RiInboxLine className="size-3.5" />
        </div>
        <span className="text-xs text-muted-foreground shrink-0 ml-2">
          {timeAgo(ticket.createdAt)}
        </span>
      </div>

      <h3 className="font-semibold text-sm leading-snug mb-3 pr-2 line-clamp-2">
        {ticket.title}
      </h3>

      <div className="flex items-center justify-between text-xs gap-2">
        <span className="text-muted-foreground truncate">
          {ticket.createdBy?.name ?? "Anonim"}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {ticket.module && (
            <span className="flex items-center gap-1.5 font-medium">
              <span
                className="size-2 rounded-sm inline-block"
                style={{ backgroundColor: ticket.module.color ?? "#94a3b8" }}
              />
              {ticket.module.name}
            </span>
          )}
          <TicketSLABadge
            slaDeadlineAt={ticket.slaDeadlineAt}
            slaStatus={ticket.slaStatus}
          />
        </div>
      </div>
    </div>
  );
}
