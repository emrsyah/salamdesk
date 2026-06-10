"use client";

import { useEffect, useMemo, useState } from "react";
import { RiCheckboxMultipleLine, RiSettings3Line } from "@remixicon/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TICKET_CONFIGURATION,
  type TicketConfiguration,
  type TicketRoutingMode,
} from "@/lib/tickets/ticket-configuration";
import { storeTicketConfiguration } from "@/lib/tickets/ticket-configuration-storage";

type Module = { id: string; name: string; color: string | null; slug: string };

interface TicketConfigurationSheetProps {
  modules: Module[];
  value: TicketConfiguration;
  onChange: (configuration: TicketConfiguration) => void;
}

const ROUTING_OPTIONS: {
  value: TicketRoutingMode;
  label: string;
  description: string;
}[] = [
  {
    value: "module_queue",
    label: "Antrian modul",
    description: "Tiket baru masuk ke antrian modul; staf mengambil sendiri.",
  },
  {
    value: "direct_assignment",
    label: "Penugasan langsung",
    description: "Tiket baru langsung ditugaskan ke staf tertentu.",
  },
  {
    value: "ai_assisted",
    label: "Dibantu AI",
    description: "AI menyarankan modul & prioritas; staf tetap yang memutuskan.",
  },
];

// ---------------------------------------------------------------------------
// Standardized building blocks: every setting = name + plain-language effect.
// ---------------------------------------------------------------------------

function SettingSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5 shrink-0" />
    </label>
  );
}

export function TicketConfigurationSheet({ modules, value, onChange }: TicketConfigurationSheetProps) {
  const [open, setOpen] = useState(false);

  // Empty enabledModuleIds means "all modules" — surface that as all checked.
  const enabledModuleIds = useMemo(() => {
    if (value.enabledModuleIds.length > 0) return value.enabledModuleIds;
    return modules.map((module) => module.id);
  }, [modules, value.enabledModuleIds]);

  const allEnabled = enabledModuleIds.length === modules.length;

  useEffect(() => {
    storeTicketConfiguration(value);
  }, [value]);

  function updateConfiguration(patch: Partial<TicketConfiguration>) {
    onChange({ ...value, ...patch });
  }

  function toggleModule(moduleId: string, checked: boolean) {
    if (!checked && enabledModuleIds.length === 1) {
      // An empty selection silently means "all modules" — blocking the last
      // uncheck is clearer than that invisible flip.
      toast.info("Minimal satu modul harus dipilih.");
      return;
    }
    const nextModuleIds = checked
      ? Array.from(new Set([...enabledModuleIds, moduleId]))
      : enabledModuleIds.filter((id) => id !== moduleId);

    updateConfiguration({ enabledModuleIds: nextModuleIds });
  }

  function handleReset() {
    onChange({ ...DEFAULT_TICKET_CONFIGURATION });
    toast.success("Konfigurasi dikembalikan ke default.");
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="icon" variant="ghost" className="size-8" aria-label="Konfigurasi tiket">
          <RiSettings3Line className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Konfigurasi Tiket</SheetTitle>
          <SheetDescription>
            Preferensi layar tiket — tersimpan otomatis di browser ini, tidak
            memengaruhi pengguna lain.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-7 px-6">
          <SettingSection
            title="Routing"
            description="Cara tiket baru masuk ke antrian dan penugasan."
          >
            <div role="radiogroup" aria-label="Mode routing" className="space-y-2">
              {ROUTING_OPTIONS.map((option) => {
                const selected = value.routingMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => updateConfiguration({ routingMode: option.value })}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "hover:border-muted-foreground/40 hover:bg-muted/40",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex size-3.5 items-center justify-center rounded-full border",
                          selected ? "border-primary" : "border-muted-foreground/50",
                        )}
                      >
                        {selected && <span className="size-2 rounded-full bg-primary" />}
                      </span>
                      <span className="text-sm font-medium">{option.label}</span>
                    </span>
                    <span className="mt-0.5 block pl-5.5 text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </SettingSection>

          <SettingSection
            title="Modul Intake"
            description="Modul yang muncul sebagai pilihan saat membuat tiket dari layar ini."
          >
            <div className="rounded-lg border">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  {allEnabled
                    ? `Semua modul (${modules.length})`
                    : `${enabledModuleIds.length} dari ${modules.length} modul`}
                </span>
                {!allEnabled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => updateConfiguration({ enabledModuleIds: [] })}
                  >
                    <RiCheckboxMultipleLine className="size-3.5" />
                    Pilih semua
                  </Button>
                )}
              </div>
              <div className="max-h-56 overflow-y-auto p-1.5">
                {modules.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted-foreground">
                    Tidak ada modul tersedia.
                  </p>
                ) : (
                  modules.map((module) => (
                    <label
                      key={module.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={enabledModuleIds.includes(module.id)}
                        onCheckedChange={(checked) => toggleModule(module.id, checked === true)}
                      />
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: module.color || "#94a3b8" }}
                      />
                      <span className="truncate">{module.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </SettingSection>

          <SettingSection
            title="Lifecycle"
            description="Aturan operasional perjalanan status tiket."
          >
            <div className="divide-y rounded-lg border px-3 py-3">
              <div className="flex items-start justify-between gap-4 pb-2.5">
                <span className="min-w-0">
                  <Label htmlFor="reopen-window" className="text-sm font-medium">
                    Jendela buka ulang
                  </Label>
                  <span className="block text-xs leading-relaxed text-muted-foreground">
                    Tiket resolved dapat dibuka ulang pelapor dalam jangka ini;
                    setelahnya tertutup otomatis.
                  </span>
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Input
                    id="reopen-window"
                    type="number"
                    min={1}
                    value={value.resolvedReopenWindowHours}
                    onChange={(event) =>
                      updateConfiguration({
                        resolvedReopenWindowHours: Number(event.target.value) || 1,
                      })
                    }
                    className="h-8 w-20 text-right"
                  />
                  <span className="text-xs text-muted-foreground">jam</span>
                </div>
              </div>
              <SwitchRow
                label="Auto-assign saat membalas"
                description="Staf pertama yang membalas publik otomatis menjadi penanggung jawab tiket."
                checked={value.autoAssignPublicReply}
                onCheckedChange={(autoAssignPublicReply) =>
                  updateConfiguration({ autoAssignPublicReply })
                }
              />
              <SwitchRow
                label="Ganti modul melepas penanggung jawab"
                description="Saat tiket dipindah modul, tiket kembali ke antrian modul tujuan."
                checked={value.moduleChangeClearsAssignee}
                onCheckedChange={(moduleChangeClearsAssignee) =>
                  updateConfiguration({ moduleChangeClearsAssignee })
                }
              />
              <SwitchRow
                label="Wajib catatan penyelesaian"
                description="Tiket hanya bisa diselesaikan jika staf menulis catatan untuk pelapor."
                checked={value.requireResolutionNote}
                onCheckedChange={(requireResolutionNote) =>
                  updateConfiguration({ requireResolutionNote })
                }
              />
            </div>
          </SettingSection>

          <SettingSection
            title="AI Triage"
            description="AI hanya membantu routing dan rekomendasi — tidak pernah menutup tiket."
          >
            <div className="divide-y rounded-lg border px-3 py-3">
              <SwitchRow
                label="AI mengisi modul awal"
                description="Saat tiket masuk tanpa modul, AI mengklasifikasikannya secara otomatis."
                checked={value.allowAiInitialRouting}
                onCheckedChange={(allowAiInitialRouting) =>
                  updateConfiguration({ allowAiInitialRouting })
                }
              />
              <SwitchRow
                label="AI merekomendasikan prioritas"
                description="AI menilai urgensi laporan dan menyesuaikan prioritas tiket."
                checked={value.allowAiPriorityRecommendation}
                onCheckedChange={(allowAiPriorityRecommendation) =>
                  updateConfiguration({ allowAiPriorityRecommendation })
                }
              />
            </div>
          </SettingSection>
        </div>

        <div className="mx-6 mt-7 mb-6 flex items-center justify-between border-t pt-4">
          <p className="text-[11px] text-muted-foreground">Perubahan tersimpan otomatis.</p>
          <Button variant="ghost" size="sm" className="text-xs" onClick={handleReset}>
            Reset ke default
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
