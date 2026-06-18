"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RiAddLine, RiCheckLine, RiEditLine } from "@remixicon/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Module = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  isActive: boolean;
};

type SlaPriority = "low" | "medium" | "critical";

type SlaConfig = {
  id: string;
  moduleId: string;
  priority: SlaPriority;
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
  isActive: boolean;
};

const PRIORITIES: { value: SlaPriority; label: string; dotClass: string }[] = [
  { value: "low", label: "Rendah", dotClass: "bg-blue-500" },
  { value: "medium", label: "Normal", dotClass: "bg-orange-500" },
  { value: "critical", label: "Kritis", dotClass: "bg-red-500" },
];

const MODULE_COLOR_PRESETS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

function formatDuration(minutes: number): string {
  if (!minutes || minutes < 1) return "—";
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d} hari`);
  if (h) parts.push(`${h} jam`);
  if (m) parts.push(`${m} mnt`);
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Duration entry: free value + unit (menit/jam/hari) + quick presets.
// Stored as minutes; the unit is purely a display/input convenience.
// ---------------------------------------------------------------------------

type DurationUnit = "menit" | "jam" | "hari";
const UNIT_FACTOR: Record<DurationUnit, number> = { menit: 1, jam: 60, hari: 1440 };

function bestUnit(minutes: number): DurationUnit {
  if (minutes >= 1440 && minutes % 1440 === 0) return "hari";
  if (minutes >= 60 && minutes % 60 === 0) return "jam";
  return "menit";
}

function DurationField({
  id,
  label,
  minutes,
  onChange,
  presets,
  autoFocus,
  onSubmit,
  onCancel,
}: {
  id: string;
  label: string;
  minutes: number;
  onChange: (minutes: number) => void;
  presets: { label: string; minutes: number }[];
  autoFocus?: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const [unit, setUnit] = React.useState<DurationUnit>(() => bestUnit(minutes));
  const displayValue = Number((minutes / UNIT_FACTOR[unit]).toFixed(2));

  function setFromDisplay(raw: string, nextUnit: DurationUnit = unit) {
    const value = Number.parseFloat(raw);
    if (Number.isNaN(value)) return;
    onChange(Math.max(1, Math.round(value * UNIT_FACTOR[nextUnit])));
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <div className="flex gap-1.5">
        <Input
          id={id}
          type="number"
          min={1}
          step="any"
          autoFocus={autoFocus}
          value={displayValue}
          onChange={(e) => setFromDisplay(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
            if (e.key === "Escape") onCancel();
          }}
          className="h-9"
        />
        <select
          aria-label={`Satuan ${label}`}
          value={unit}
          onChange={(e) => {
            const nextUnit = e.target.value as DurationUnit;
            setUnit(nextUnit);
            // Keep the displayed number, reinterpret it in the new unit
            // (2 jam → 2 hari), which is what unit switching usually means.
            setFromDisplay(String(displayValue), nextUnit);
          }}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="menit">menit</option>
          <option value="jam">jam</option>
          <option value="hari">hari</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-1">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              onChange(preset.minutes);
              setUnit(bestUnit(preset.minutes));
            }}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] transition-colors hover:bg-muted",
              minutes === preset.minutes
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">= {formatDuration(minutes)}</p>
    </div>
  );
}

const RESPONSE_PRESETS = [
  { label: "15 mnt", minutes: 15 },
  { label: "30 mnt", minutes: 30 },
  { label: "1 jam", minutes: 60 },
  { label: "4 jam", minutes: 240 },
  { label: "1 hari", minutes: 1440 },
];

const RESOLUTION_PRESETS = [
  { label: "2 jam", minutes: 120 },
  { label: "8 jam", minutes: 480 },
  { label: "1 hari", minutes: 1440 },
  { label: "3 hari", minutes: 4320 },
  { label: "7 hari", minutes: 10080 },
];

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modules: Module[];
  slaConfigs: SlaConfig[];
}

export function SettingsDialog({ open, onOpenChange, modules, slaConfigs }: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(680px,85vh)] w-full flex-col overflow-hidden max-w-3xl!">
        <DialogHeader>
          <DialogTitle>Pengaturan</DialogTitle>
          <DialogDescription>
            Kelola modul SIMRS dan target SLA untuk tiap prioritas.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="modules" className="flex min-h-0 flex-1 flex-col">
          <TabsList variant="line" className="w-full justify-start rounded-none border-b">
            <TabsTrigger value="modules">Modul SIMRS</TabsTrigger>
            <TabsTrigger value="sla">Target SLA</TabsTrigger>
          </TabsList>

          <TabsContent value="modules" className="mt-0 min-h-0 flex-1 overflow-y-auto pt-4">
            <ModulesTab modules={modules} />
          </TabsContent>

          <TabsContent value="sla" className="mt-0 min-h-0 flex-1 overflow-y-auto pt-4">
            <SlaTab modules={modules} slaConfigs={slaConfigs} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Modul SIMRS
// ---------------------------------------------------------------------------

function ModulesTab({ modules }: { modules: Module[] }) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingModule, setEditingModule] = React.useState<Module | null>(null);
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(MODULE_COLOR_PRESETS[5]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [togglingIds, setTogglingIds] = React.useState<Set<string>>(new Set());

  function openForm(module?: Module) {
    setEditingModule(module ?? null);
    setName(module?.name ?? "");
    setColor(module?.color ?? MODULE_COLOR_PRESETS[5]);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingModule(null);
  }

  async function handleSave() {
    if (!name.trim() || isSaving) return;
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.set("name", name.trim());
      formData.set("color", color);

      const actions = await import("@/actions/modules.actions");
      const result = editingModule
        ? await actions.updateModuleAction(editingModule.id, formData)
        : await actions.createModuleAction(formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(editingModule ? "Modul diperbarui" : `Modul "${name.trim()}" ditambahkan`);
      closeForm();
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggle(module: Module) {
    setTogglingIds((current) => new Set(current).add(module.id));
    try {
      const { toggleModuleActiveAction } = await import("@/actions/modules.actions");
      const result = await toggleModuleActiveAction(module.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        module.isActive
          ? `"${module.name}" dinonaktifkan — tidak muncul di pilihan tiket baru`
          : `"${module.name}" diaktifkan`,
      );
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setTogglingIds((current) => {
        const next = new Set(current);
        next.delete(module.id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {modules.length} modul · {modules.filter((m) => m.isActive).length} aktif
        </p>
        {!isFormOpen && (
          <Button onClick={() => openForm()} size="sm" className="gap-1.5">
            <RiAddLine className="size-4" />
            Tambah Modul
          </Button>
        )}
      </div>

      {isFormOpen && (
        <div className="rounded-xl border bg-muted/40 p-4">
          <h4 className="mb-3 text-sm font-semibold">
            {editingModule ? `Edit "${editingModule.name}"` : "Modul baru"}
          </h4>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="module-name">Nama Modul</Label>
              <Input
                id="module-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") closeForm();
                }}
                placeholder="Contoh: Farmasi"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Warna</Label>
              <div className="flex flex-wrap items-center gap-1.5">
                {MODULE_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setColor(preset)}
                    aria-label={`Pilih warna ${preset}`}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md transition-transform hover:scale-110",
                      color === preset && "ring-2 ring-foreground/60 ring-offset-1",
                    )}
                    style={{ backgroundColor: preset }}
                  >
                    {color === preset && <RiCheckLine className="size-4 text-white" />}
                  </button>
                ))}
                <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="size-7 cursor-pointer rounded-md border bg-transparent p-0.5"
                  />
                  Kustom
                </label>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={handleSave} disabled={!name.trim() || isSaving}>
                {isSaving ? "Menyimpan…" : editingModule ? "Simpan Perubahan" : "Buat Modul"}
              </Button>
              <Button variant="ghost" size="sm" onClick={closeForm} disabled={isSaving}>
                Batal
              </Button>
              {/* Live preview of how the module chip will look in the app. */}
              {name.trim() && (
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs">
                  <span className="size-2 rounded-sm" style={{ backgroundColor: color }} />
                  {name.trim()}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {modules.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Belum ada modul. Tambahkan modul pertama untuk mulai mengelompokkan tiket.
          </p>
        ) : (
          modules.map((module) => (
            <div
              key={module.id}
              className={cn(
                "flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/40",
                !module.isActive && "opacity-60",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="size-8 shrink-0 rounded-md"
                  style={{ backgroundColor: module.color || "#94a3b8" }}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">{module.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{module.slug}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openForm(module)}
                  aria-label={`Edit ${module.name}`}
                >
                  <RiEditLine className="size-4" />
                </Button>
                <div className="flex w-20 items-center gap-2">
                  <Switch
                    checked={module.isActive}
                    disabled={togglingIds.has(module.id)}
                    onCheckedChange={() => handleToggle(module)}
                    aria-label={`${module.isActive ? "Nonaktifkan" : "Aktifkan"} ${module.name}`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {module.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Target SLA — a module × priority matrix; click a slot to edit in place.
// ---------------------------------------------------------------------------

type SlaSlot = { moduleId: string; priority: SlaPriority };

function SlaTab({ modules, slaConfigs }: { modules: Module[]; slaConfigs: SlaConfig[] }) {
  const router = useRouter();
  const activeModules = modules.filter((m) => m.isActive);
  const [editingSlot, setEditingSlot] = React.useState<SlaSlot | null>(null);
  const [responseTime, setResponseTime] = React.useState(30);
  const [resolutionTime, setResolutionTime] = React.useState(120);
  const [isSaving, setIsSaving] = React.useState(false);

  const configFor = (moduleId: string, priority: SlaPriority) =>
    slaConfigs.find((c) => c.moduleId === moduleId && c.priority === priority) ?? null;

  function openSlot(slot: SlaSlot) {
    const existing = configFor(slot.moduleId, slot.priority);
    setResponseTime(existing?.responseTimeMinutes ?? 30);
    setResolutionTime(existing?.resolutionTimeMinutes ?? 120);
    setEditingSlot(slot);
  }

  async function handleSave() {
    if (!editingSlot || isSaving) return;
    if (responseTime < 1 || resolutionTime < 1) {
      toast.error("Waktu harus minimal 1 menit.");
      return;
    }
    setIsSaving(true);
    try {
      const { upsertSlaConfigAction } = await import("@/actions/modules.actions");
      const result = await upsertSlaConfigAction(
        editingSlot.moduleId,
        editingSlot.priority,
        responseTime,
        resolutionTime,
      );
      if (!result.success) {
        toast.error("Terjadi kesalahan, kontak developer");
        return;
      }
      toast.success("Target SLA disimpan");
      setEditingSlot(null);
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setIsSaving(false);
    }
  }

  if (activeModules.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Belum ada modul aktif. Tambahkan modul dulu di tab &quot;Modul SIMRS&quot;.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Klik salah satu prioritas untuk mengatur target waktu respon &amp; resolusinya.
      </p>

      {activeModules.map((module) => (
        <div key={module.id} className="rounded-xl border p-3">
          <div className="mb-2.5 flex items-center gap-2">
            <span
              className="size-2.5 rounded-sm"
              style={{ backgroundColor: module.color || "#94a3b8" }}
            />
            <h4 className="text-sm font-semibold">{module.name}</h4>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PRIORITIES.map((priority) => {
              const config = configFor(module.id, priority.value);
              const isEditing =
                editingSlot?.moduleId === module.id &&
                editingSlot?.priority === priority.value;

              return (
                <button
                  key={priority.value}
                  type="button"
                  onClick={() =>
                    isEditing
                      ? setEditingSlot(null)
                      : openSlot({ moduleId: module.id, priority: priority.value })
                  }
                  className={cn(
                    "rounded-lg border p-2.5 text-left transition-colors hover:border-primary/50 hover:bg-muted/40",
                    isEditing && "border-primary ring-1 ring-primary/30",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <span className={cn("size-1.5 rounded-full", priority.dotClass)} />
                    {priority.label}
                  </span>
                  {config ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Respon {formatDuration(config.responseTimeMinutes)} · Resolusi{" "}
                      {formatDuration(config.resolutionTimeMinutes)}
                    </span>
                  ) : (
                    <span className="mt-1 block text-xs italic text-muted-foreground/70">
                      Belum diatur — klik untuk atur
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {editingSlot?.moduleId === module.id && (
            <div
              key={`${editingSlot.moduleId}-${editingSlot.priority}`}
              className="mt-2.5 rounded-lg border bg-muted/40 p-3"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DurationField
                  id="sla-response"
                  label="Respon pertama"
                  minutes={responseTime}
                  onChange={setResponseTime}
                  presets={RESPONSE_PRESETS}
                  autoFocus
                  onSubmit={handleSave}
                  onCancel={() => setEditingSlot(null)}
                />
                <DurationField
                  id="sla-resolution"
                  label="Resolusi"
                  minutes={resolutionTime}
                  onChange={setResolutionTime}
                  presets={RESOLUTION_PRESETS}
                  onSubmit={handleSave}
                  onCancel={() => setEditingSlot(null)}
                />
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Menyimpan…" : "Simpan Target"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingSlot(null)}
                  disabled={isSaving}
                >
                  Batal
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
