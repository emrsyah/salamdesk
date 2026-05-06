"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RiAddLine, RiEditLine, RiCloseLine, RiPencilLine, RiTimeLine } from "@remixicon/react";


import { toast } from "sonner";

type Module = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  isActive: boolean;
};

type SlaConfig = {
  id: string;
  moduleId: string;
  priority: "low" | "medium" | "critical";
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
  isActive: boolean;
};

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modules: Module[];
  slaConfigs: SlaConfig[];
}

export function SettingsDialog({ open, onOpenChange, modules, slaConfigs }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = React.useState("modules");
  
  const moduleFormRef = React.useRef<HTMLDivElement>(null);
  const slaFormRef = React.useRef<HTMLDivElement>(null);

  // Module state
  const [isModuleFormOpen, setIsModuleFormOpen] = React.useState(false);
  const [editingModule, setEditingModule] = React.useState<Module | null>(null);
  const [moduleName, setModuleName] = React.useState("");
  const [moduleColor, setModuleColor] = React.useState("#94a3b8");

  // SLA Config state
  const [selectedModuleForSla, setSelectedModuleForSla] = React.useState<string>("");
  const [slaPriority, setSlaPriority] = React.useState<"low" | "medium" | "critical">("medium");
  const [responseTime, setResponseTime] = React.useState(30);
  const [resolutionTime, setResolutionTime] = React.useState(120);

  const handleEditSla = (config: SlaConfig) => {
    setSelectedModuleForSla(config.moduleId);
    setSlaPriority(config.priority);
    setResponseTime(config.responseTimeMinutes);
    setResolutionTime(config.resolutionTimeMinutes);
    setActiveTab("sla");
    setTimeout(() => slaFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const handleClearSlaForm = () => {
    setSelectedModuleForSla("");
    setSlaPriority("medium");
    setResponseTime(30);
    setResolutionTime(120);
  };

  const handleOpenModuleForm = (module?: Module) => {
    setIsModuleFormOpen(true);
    if (module) {
      setEditingModule(module);
      setModuleName(module.name);
      setModuleColor(module.color || "#94a3b8");
    } else {
      setEditingModule(null);
      setModuleName("");
      setModuleColor("#94a3b8");
    }
    setTimeout(() => moduleFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const handleCloseModuleForm = () => {
    setIsModuleFormOpen(false);
    setEditingModule(null);
  };

  const handleSaveModule = async () => {
    try {
      if (editingModule) {
        const formData = new FormData();
        formData.set("name", moduleName);
        formData.set("color", moduleColor);
        const { updateModuleAction } = await import("@/actions/modules.actions");
        const result = await updateModuleAction(editingModule.id, formData);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Modul berhasil diperbarui");
      } else {
        const formData = new FormData();
        formData.set("name", moduleName);
        formData.set("color", moduleColor);
        const { createModuleAction } = await import("@/actions/modules.actions");
        const result = await createModuleAction(formData);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Modul berhasil ditambahkan");
      }
      setEditingModule(null);
      setModuleName("");
      setModuleColor("#94a3b8");
      window.location.reload();
    } catch {
      toast.error("Terjadi kesalahan");
    }
  };

  const handleToggleModule = async (moduleId: string) => {
    try {
      const { toggleModuleActiveAction } = await import("@/actions/modules.actions");
      const result = await toggleModuleActiveAction(moduleId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Status modul berhasil diubah");
      window.location.reload();
    } catch {
      toast.error("Terjadi kesalahan");
    }
  };

  const handleSaveSlaConfig = async () => {
    if (!selectedModuleForSla) {
      toast.error("Pilih modul terlebih dahulu");
      return;
    }
    try {
      const { upsertSlaConfigAction } = await import("@/actions/modules.actions");
      const result = await upsertSlaConfigAction(
        selectedModuleForSla,
        slaPriority,
        responseTime,
        resolutionTime
      );
      if (!result.success) {
        toast.error("Terjadi kesalahan, kontak developer");
        return;
      }
      toast.success("Konfigurasi SLA berhasil disimpan");
      window.location.reload();
    } catch {
      toast.error("Terjadi kesalahan");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl! w-full! max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Pengaturan</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
          <TabsList variant="line" className="w-full justify-start border-b rounded-none">
            <TabsTrigger value="modules">Modul SIMRS</TabsTrigger>
            <TabsTrigger value="sla">Konfigurasi SLA</TabsTrigger>
          </TabsList>

          <TabsContent value="modules" className="mt-0 flex-1 overflow-auto">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Daftar Modul</h3>
                {!isModuleFormOpen && (
                  <Button onClick={() => handleOpenModuleForm()} size="sm">
                    <RiAddLine className="mr-2 size-4" />
                    Tambah Modul
                  </Button>
                )}
              </div>

              {isModuleFormOpen && (
                <div ref={moduleFormRef} className="border rounded-lg p-4 bg-muted/50 scroll-mt-4">
                  <h4 className="font-medium mb-4">
                    {editingModule ? "Edit Modul" : "Tambah Modul Baru"}
                  </h4>
                  <div className="grid gap-4 max-w-md">
                    <div>
                      <Label htmlFor="module-name">Nama Modul</Label>
                      <Input
                        id="module-name"
                        value={moduleName}
                        onChange={(e) => setModuleName(e.target.value)}
                        placeholder="Contoh: Farmasi"
                      />
                    </div>
                    <div>
                      <Label htmlFor="module-color">Warna</Label>
                      <div className="flex gap-2 items-center">
                        <Input
                          id="module-color"
                          type="color"
                          value={moduleColor}
                          onChange={(e) => setModuleColor(e.target.value)}
                          className="w-16 h-10"
                        />
                        <Input
                          value={moduleColor}
                          onChange={(e) => setModuleColor(e.target.value)}
                          placeholder="#94a3b8"
                          className="flex-1"
                        />
                        <div
                          className="size-10 rounded border"
                          style={{ backgroundColor: moduleColor }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveModule} size="sm">
                        <RiPencilLine className="mr-2 size-4" />
                        {editingModule ? "Simpan" : "Buat Modul"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCloseModuleForm}
                        size="sm"
                      >
                        Batal
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {modules.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Belum ada modul. Tambahkan modul pertama.
                  </p>
                ) : (
                  modules.map((module) => (
                    <div
                      key={module.id}
                      className="flex items-center justify-between border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="size-8 rounded-md"
                          style={{ backgroundColor: module.color || "#94a3b8" }}
                        />
                        <div>
                          <p className="font-medium">{module.name}</p>
                          <p className="text-sm text-muted-foreground">{module.slug}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={module.isActive}
                          onCheckedChange={() => handleToggleModule(module.id)}
                        />
                        <span className="text-xs text-muted-foreground w-16">
                          {module.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleOpenModuleForm(module)}
                          disabled={editingModule?.id === module.id}
                        >
                          <RiEditLine className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sla" className="mt-0 flex-1 overflow-auto">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Konfigurasi SLA</h3>
                <p className="text-sm text-muted-foreground">
                  Atur waktu respon dan resolusi untuk setiap modul dan prioritas.
                </p>
              </div>

              <div ref={slaFormRef} className="border rounded-lg p-4 bg-muted/50 scroll-mt-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium">Tambah/Edit Konfigurasi SLA</h4>
                  {selectedModuleForSla && (
                    <Button variant="ghost" size="sm" onClick={handleClearSlaForm} className="h-8">
                      Batal
                    </Button>
                  )}
                </div>
                <div className="grid gap-4 max-w-md">
                  <div>
                    <Label htmlFor="module-select">Modul</Label>
                    <Select value={selectedModuleForSla} onValueChange={setSelectedModuleForSla}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih modul" />
                      </SelectTrigger>
                      <SelectContent>
                        {modules
                          .filter((m) => m.isActive)
                          .map((module) => (
                            <SelectItem key={module.id} value={module.id}>
                              {module.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="priority-select">Prioritas</Label>
                    <Select
                      value={slaPriority}
                      onValueChange={(val) => setSlaPriority(val as "low" | "medium" | "critical")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih prioritas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="response-time">Respon (menit)</Label>
                      <Input
                        id="response-time"
                        type="number"
                        min="1"
                        value={responseTime}
                        onChange={(e) => setResponseTime(Number(e.target.value))}
                        placeholder="30"
                      />
                    </div>

                    <div>
                      <Label htmlFor="resolution-time">Resolusi (menit)</Label>
                      <Input
                        id="resolution-time"
                        type="number"
                        min="1"
                        value={resolutionTime}
                        onChange={(e) => setResolutionTime(Number(e.target.value))}
                        placeholder="120"
                      />
                    </div>
                  </div>

                  <Button onClick={handleSaveSlaConfig}>
                    <RiPencilLine className="mr-2 size-4" />
                    Simpan Konfigurasi
                  </Button>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Konfigurasi Saat Ini</h4>
                {slaConfigs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Belum ada konfigurasi SLA.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {slaConfigs
                      .filter((config) => {
                        const module = modules.find((m) => m.id === config.moduleId);
                        return module?.isActive;
                      })
                      .map((config) => {
                        const module = modules.find((m) => m.id === config.moduleId);
                        return (
                          <div
                            key={config.id}
                            className="flex flex-col border rounded-lg p-3 hover:border-primary/50 transition-colors group bg-card"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className="size-3 rounded-full"
                                  style={{ backgroundColor: module?.color || "#94a3b8" }}
                                />
                                <span className="font-medium text-sm">{module?.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    config.priority === "critical"
                                      ? "destructive"
                                      : config.priority === "medium"
                                        ? "secondary"
                                        : "outline"
                                  }
                                  className="text-[10px] uppercase px-1.5 py-0"
                                >
                                  {config.priority}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => handleEditSla(config)}
                                >
                                  <RiEditLine className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-auto text-xs text-muted-foreground">
                              <div className="flex items-center gap-1.5 bg-muted/40 p-1.5 rounded">
                                <RiTimeLine className="size-3.5" />
                                <span>Respon: {config.responseTimeMinutes}m</span>
                              </div>
                              <div className="flex items-center gap-1.5 bg-muted/40 p-1.5 rounded">
                                <RiTimeLine className="size-3.5" />
                                <span>Resolusi: {config.resolutionTimeMinutes}m</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <RiCloseLine className="mr-2 size-4" />
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
