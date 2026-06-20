import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RiInformationLine } from "@remixicon/react";

export function AgentTabIntro({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/20 text-amber-600 dark:text-amber-400">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children ? <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function StatusPill({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        on
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span className={cn("size-1.5 rounded-full", on ? "bg-green-500" : "bg-muted-foreground/50")} />
      {label}
    </span>
  );
}

export function AgentSection({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border", className)}>
      <div className="flex items-start gap-2.5 border-b bg-muted/30 px-4 py-3">
        {icon ? (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="divide-y px-4">{children}</div>
    </section>
  );
}

export function SettingRow({
  label,
  hint,
  children,
  bypassed = false,
  bypassLabel = "Dilewati",
  bypassHint,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  bypassed?: boolean;
  bypassLabel?: string;
  bypassHint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn("text-sm font-medium", bypassed && "text-muted-foreground line-through")}>
          {label}
        </span>
        {bypassed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-default items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                <span className="size-1.5 rounded-full bg-amber-500" />
                {bypassLabel}
              </span>
            </TooltipTrigger>
            {bypassHint && <TooltipContent side="top">{bypassHint}</TooltipContent>}
          </Tooltip>
        ) : hint ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex items-center text-muted-foreground/50 transition-colors hover:text-muted-foreground"
              >
                <RiInformationLine className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{hint}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <div className={cn("shrink-0", bypassed && "opacity-40")}>{children}</div>
    </div>
  );
}
