"use client";

import { useEffect, useMemo, useState } from "react";
import { RiSettings3Line } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
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

const ROUTING_LABELS: Record<TicketRoutingMode, string> = {
  module_queue: "Antrian modul",
  direct_assignment: "Penugasan langsung",
  ai_assisted: "Dibantu AI",
};

export function TicketConfigurationSheet({ modules, value, onChange }: TicketConfigurationSheetProps) {
  const [open, setOpen] = useState(false);

  const enabledModuleIds = useMemo(() => {
    if (value.enabledModuleIds.length > 0) return value.enabledModuleIds;
    return modules.map((module) => module.id);
  }, [modules, value.enabledModuleIds]);

  useEffect(() => {
    storeTicketConfiguration(value);
  }, [value]);

  function updateConfiguration(patch: Partial<TicketConfiguration>) {
    onChange({ ...value, ...patch });
  }

  function toggleModule(moduleId: string, checked: boolean) {
    const nextModuleIds = checked
      ? Array.from(new Set([...enabledModuleIds, moduleId]))
      : enabledModuleIds.filter((id) => id !== moduleId);

    updateConfiguration({ enabledModuleIds: nextModuleIds });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="icon" variant="ghost" className="size-8" aria-label="Konfigurasi tiket">
          <RiSettings3Line className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Konfigurasi Tiket</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">Routing</h3>
              <p className="text-xs text-muted-foreground">
                Atur cara tiket baru masuk ke antrian dan penugasan.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-routing-mode">Mode routing</Label>
              <Select
                value={value.routingMode}
                onValueChange={(routingMode) => updateConfiguration({ routingMode: routingMode as TicketRoutingMode })}
              >
                <SelectTrigger id="ticket-routing-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROUTING_LABELS).map(([mode, label]) => (
                    <SelectItem key={mode} value={mode}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">Modul Intake</h3>
              <p className="text-xs text-muted-foreground">
                Modul yang tersedia saat membuat tiket dari layar ini.
              </p>
            </div>
            <div className="space-y-2 rounded-md border p-3">
              {modules.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada modul tersedia.</p>
              ) : (
                modules.map((module) => (
                  <label key={module.id} className="flex items-center gap-3 text-sm">
                    <Checkbox
                      checked={enabledModuleIds.includes(module.id)}
                      onCheckedChange={(checked) => toggleModule(module.id, checked === true)}
                    />
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: module.color || "#94a3b8" }}
                    />
                    <span>{module.name}</span>
                  </label>
                ))
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">Lifecycle</h3>
              <p className="text-xs text-muted-foreground">
                Aturan operasional dari desain lifecycle tiket.
              </p>
            </div>
            <div className="space-y-4 rounded-md border p-3">
              <div className="space-y-1.5">
                <Label htmlFor="reopen-window">Window buka ulang resolved (jam)</Label>
                <Input
                  id="reopen-window"
                  type="number"
                  min={1}
                  value={value.resolvedReopenWindowHours}
                  onChange={(event) =>
                    updateConfiguration({ resolvedReopenWindowHours: Number(event.target.value) || 1 })
                  }
                />
              </div>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Balasan publik auto-assign ke staf</span>
                <Switch
                  checked={value.autoAssignPublicReply}
                  onCheckedChange={(autoAssignPublicReply) => updateConfiguration({ autoAssignPublicReply })}
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Ganti modul melepas assignee</span>
                <Switch
                  checked={value.moduleChangeClearsAssignee}
                  onCheckedChange={(moduleChangeClearsAssignee) =>
                    updateConfiguration({ moduleChangeClearsAssignee })
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Wajib catatan penyelesaian</span>
                <Switch
                  checked={value.requireResolutionNote}
                  onCheckedChange={(requireResolutionNote) => updateConfiguration({ requireResolutionNote })}
                />
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">AI Triage</h3>
              <p className="text-xs text-muted-foreground">
                AI hanya membantu routing dan rekomendasi, bukan menutup tiket.
              </p>
            </div>
            <div className="space-y-4 rounded-md border p-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Izinkan AI set modul awal</span>
                <Switch
                  checked={value.allowAiInitialRouting}
                  onCheckedChange={(allowAiInitialRouting) => updateConfiguration({ allowAiInitialRouting })}
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Izinkan rekomendasi prioritas AI</span>
                <Switch
                  checked={value.allowAiPriorityRecommendation}
                  onCheckedChange={(allowAiPriorityRecommendation) =>
                    updateConfiguration({ allowAiPriorityRecommendation })
                  }
                />
              </label>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
