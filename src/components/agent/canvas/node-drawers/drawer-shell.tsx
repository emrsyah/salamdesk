"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";

/**
 * Pure layout for a stage node's edit drawer: docked-right sheet, a bespoke
 * (non-tab) header, a scrollable body, and an optional sticky footer slot.
 * Both drawer kinds below compose this.
 */
export function DrawerFrame({
  open,
  onOpenChange,
  icon,
  title,
  description,
  width = "sm:max-w-md",
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: ReactNode;
  title: string;
  description: string;
  /** Tailwind max-width class — wider for the reuse-leaf editors. */
  width?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={`w-full gap-0 p-0 ${width}`}>
        <div className="flex items-start gap-3 border-b px-5 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
            {icon}
          </span>
          <div className="min-w-0 flex-1 pr-8">
            <SheetTitle className="text-base font-semibold leading-tight">{title}</SheetTitle>
            <SheetDescription className="mt-0.5 text-sm text-muted-foreground">
              {description}
            </SheetDescription>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? <div className="border-t px-5 py-3">{footer}</div> : null}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Form-kind drawer: the body reports a partial config update; this shell owns
 * the Save/Batal footer, pending state, success toast, and `router.refresh()`.
 */
export function FormDrawer({
  open,
  onOpenChange,
  icon,
  title,
  description,
  children,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  /** Persist this node's fields. Throw to surface an error toast. */
  onSave: () => Promise<void>;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave();
      toast.success("Tersimpan");
      router.refresh();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DrawerFrame
      open={open}
      onOpenChange={onOpenChange}
      icon={icon}
      title={title}
      description={description}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      }
    >
      {children}
    </DrawerFrame>
  );
}

