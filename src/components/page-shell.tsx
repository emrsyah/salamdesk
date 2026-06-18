import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Unified page scaffolding so every top-level app page shares the same width,
 * padding, and header style (matching the dashboard's full-width layout).
 *
 * Usage:
 *   <PageContainer>
 *     <PageHeader title="…" description="…" actions={<Button…/>} />
 *     …content…
 *   </PageContainer>
 */

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-6 p-4 md:p-6", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  icon,
  actions,
}: {
  title: string;
  description?: string;
  /** Optional leading icon, shown in an amber rounded square. */
  icon?: ReactNode;
  /** Optional right-aligned actions (buttons, selectors). */
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-2.5">
        {icon ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-600 dark:text-amber-400">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
