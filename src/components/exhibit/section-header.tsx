import { cn } from "@/lib/utils";

/**
 * The column label atop each wall section. Rendered with enough weight/contrast
 * to stay legible over the bright sky atmosphere behind the active console — a
 * colored accent tick + dark mono label, with an optional right-aligned slot.
 */
export function SectionHeader({
  label,
  accent = "bg-primary",
  right,
  className,
}: {
  label: string;
  /** Tailwind bg-* token for the leading accent tick. */
  accent?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-3 flex shrink-0 items-center gap-2.5",
        className,
      )}
    >
      <span className={cn("h-3.5 w-1 rounded-full", accent)} />
      <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-zinc-700">
        {label}
      </h2>
      {right != null && <div className="ml-auto min-w-0">{right}</div>}
    </div>
  );
}
