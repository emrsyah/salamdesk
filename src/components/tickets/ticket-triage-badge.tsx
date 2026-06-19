"use client";

import { RiLoader4Line, RiSparklingLine, RiErrorWarningLine } from "@remixicon/react";
import { cn } from "@/lib/utils";

export type TriageStatus = "processing" | "completed" | "failed" | "skipped" | null | undefined;

interface TicketTriageBadgeProps {
  /** Latest persisted triage status (survives reload). */
  status?: TriageStatus;
  /** Live "started but not completed" signal from the SSE stream. */
  isTriaging?: boolean;
  /** Compact = list item (icon-forward); full = detail header (with label). */
  compact?: boolean;
  className?: string;
}

/**
 * Surfaces AI triage state on a ticket: a live "menganalisis…" spinner while
 * the worker is classifying, a subtle "AI" mark once done, and a clear failure
 * pill if triage errored. Renders nothing when triage hasn't run / was skipped.
 */
export function TicketTriageBadge({
  status,
  isTriaging,
  compact = false,
  className,
}: TicketTriageBadgeProps) {
  const running = isTriaging || status === "processing";

  if (running) {
    return (
      <span
        title="AI sedang menganalisis tiket ini"
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-amber-200/70 bg-amber-50 px-2 py-0.5 text-[11px] font-medium leading-4 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300",
          className,
        )}
      >
        <RiLoader4Line className="size-3 shrink-0 animate-spin" />
        {compact ? "AI" : "AI menganalisis…"}
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span
        title="Sudah ditriase oleh AI"
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-amber-200/60 bg-amber-50/60 px-2 py-0.5 text-[11px] font-medium leading-4 text-amber-700/90 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300/90",
          className,
        )}
      >
        <RiSparklingLine className="size-3 shrink-0" />
        {compact ? "AI" : "Ditriase AI"}
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span
        title="Triase AI gagal — coba triase ulang"
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-red-200/70 bg-red-50 px-2 py-0.5 text-[11px] font-medium leading-4 text-red-700 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-300",
          className,
        )}
      >
        <RiErrorWarningLine className="size-3 shrink-0" />
        {compact ? "AI" : "Triase gagal"}
      </span>
    );
  }

  return null;
}
