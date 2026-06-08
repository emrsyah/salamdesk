"use client";

import { useEffect, useState } from "react";
import { RiTimerLine } from "@remixicon/react";
import { cn } from "@/lib/utils";

interface TicketSLABadgeProps {
  slaDeadlineAt: Date | string | null;
  slaStatus: "safe" | "warning" | "breached";
  label?: string;
  completedAt?: Date | string | null;
  className?: string;
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.abs(Math.round(ms / 60000));
  if (totalMinutes < 60) return `${totalMinutes} m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours} j ${mins} m` : `${hours} j`;
}

export function TicketSLABadge({ slaDeadlineAt, slaStatus, label, completedAt, className }: TicketSLABadgeProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!slaDeadlineAt) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        Tidak ada SLA
      </span>
    );
  }

  if (completedAt) {
    return (
      <span
        className={cn(
          "flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded border text-green-600 bg-green-50 border-green-200/50",
          className,
        )}
      >
        <RiTimerLine className="size-3 shrink-0" />
        {label ? `${label}: selesai` : "Selesai"}
      </span>
    );
  }

  const deadline = new Date(slaDeadlineAt);
  const diff = deadline.getTime() - now.getTime();
  const isBreached = diff < 0;

  const colorClass =
    isBreached || slaStatus === "breached"
      ? "text-red-500 bg-red-50 border-red-200/50"
      : slaStatus === "warning"
        ? "text-yellow-600 bg-yellow-50 border-yellow-200/50"
        : "text-green-600 bg-green-50 border-green-200/50";

  const timeLabel = isBreached
    ? `Lewat ${formatDuration(-diff)}`
    : `${formatDuration(diff)} sisa`;

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded border",
        colorClass,
        className,
      )}
    >
      <RiTimerLine className="size-3 shrink-0" />
      {label ? `${label}: ${timeLabel}` : timeLabel}
    </span>
  );
}
