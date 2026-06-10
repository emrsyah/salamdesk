"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { RiCheckLine, RiSearchLine } from "@remixicon/react";

export type InlinePickerOption = {
  value: string | null;
  label: string;
  /** Muted text rendered after the label (e.g. a role or department). */
  description?: string;
  /** Color swatch shown before the label (e.g. module color). */
  color?: string | null;
};

interface InlinePickerProps {
  options: InlinePickerOption[];
  value: string | null;
  onSelect: (value: string | null) => void;
  /** Defaults to showing the search bar only when the list is long. */
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  /** The trigger element — rendered via asChild, must accept a ref. */
  children: ReactNode;
}

/**
 * A lightweight command-style picker: click the trigger, optionally type to
 * filter, click (or Enter) to apply. Used for editing ticket metadata in
 * place without opening the full Rute dialog.
 */
export function InlinePicker({
  options,
  value,
  onSelect,
  searchable = options.length > 6,
  searchPlaceholder = "Cari…",
  disabled = false,
  align = "start",
  children,
}: InlinePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) ||
        option.description?.toLowerCase().includes(q),
    );
  }, [options, query]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
  }

  function select(next: string | null) {
    handleOpenChange(false);
    if (next !== value) onSelect(next);
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        {children}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={6}
          className="z-50 w-60 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          {searchable && (
            <div className="mb-1 flex items-center gap-2 border-b px-2 pb-1.5 pt-1">
              <RiSearchLine className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && filtered.length > 0) {
                    event.preventDefault();
                    select(filtered[0].value);
                  }
                }}
                placeholder={searchPlaceholder}
                className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Tidak ditemukan
              </div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value ?? "__none"}
                  type="button"
                  onClick={() => select(option.value)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  {option.color !== undefined && (
                    <span
                      className="size-2 shrink-0 rounded-sm border border-border/50"
                      style={{ backgroundColor: option.color ?? "transparent" }}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {option.label}
                    {option.description && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {option.value === value && (
                    <RiCheckLine className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                </button>
              ))
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
