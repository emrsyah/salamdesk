"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  RiAddLine,
  RiCloseLine,
  RiFlowChart,
  RiReplyLine,
  RiCalendarScheduleLine,
  RiMagicLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BusinessHours, ReplyMode } from "@/lib/agent/business-hours";
import { AgentTabIntro, AgentSection, SettingRow, StatusPill } from "./agent-ui";

type AutomationConfig = {
  aiTriageEnabled: boolean;
  autoClassifyModule: boolean;
  moduleConfidenceThreshold: number;
  autoSetPriority: boolean;
  kbCrossModuleSearch: boolean;
  procedureConfidenceThreshold: number;
  offTopicGuardEnabled: boolean;
  aiFirstMode: boolean;
  autoReplyEnabled: boolean;
  replyConfidenceThreshold: number;
  autoReplyDelayMinutes: number;
  autoReplyChannels: string[];
  skipCriticalPriority: boolean;
  requireKbGrounding: boolean;
  blockedKeywords: string[];
  limitAutoRepliesPerTicket: boolean;
  maxAutoRepliesPerTicket: number;
  businessHours: BusinessHours;
  offHoursReplyEnabled: boolean;
  offHoursMessage: string;
};

const CHANNELS = ["whatsapp", "web", "email"];
const DAYS = [
  { value: 1, label: "Sen" },
  { value: 2, label: "Sel" },
  { value: 3, label: "Rab" },
  { value: 4, label: "Kam" },
  { value: 5, label: "Jum" },
  { value: 6, label: "Sab" },
  { value: 0, label: "Min" },
];

const Row = SettingRow;

export function AgentAutomationForm({ config }: { config: AutomationConfig }) {
  const router = useRouter();
  const [form, setForm] = useState<AutomationConfig>(config);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof AutomationConfig>(key: K, value: AutomationConfig[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setHours = (patch: Partial<BusinessHours>) =>
    setForm((f) => ({ ...f, businessHours: { ...f.businessHours, ...patch } }));

  const toggleChannel = (ch: string) =>
    set(
      "autoReplyChannels",
      form.autoReplyChannels.includes(ch)
        ? form.autoReplyChannels.filter((c) => c !== ch)
        : [...form.autoReplyChannels, ch],
    );

  const addKeyword = () => {
    const k = keywordDraft.trim();
    if (k && !form.blockedKeywords.includes(k)) set("blockedKeywords", [...form.blockedKeywords, k]);
    setKeywordDraft("");
  };

  const windows = form.businessHours.windows;
  const invalidWindow = windows.some((w) => w.start >= w.end);

  const updateWindow = (i: number, patch: Partial<BusinessHours["windows"][number]>) =>
    setHours({ windows: windows.map((w, idx) => (idx === i ? { ...w, ...patch } : w)) });

  const addWindow = () =>
    setHours({
      windows: [
        ...windows,
        { days: [1, 2, 3, 4, 5], start: "08:00", end: "17:00", mode: "draft-only" },
      ],
    });

  async function handleSave() {
    if (invalidWindow) {
      toast.error("Setiap jendela jadwal harus punya jam mulai sebelum jam selesai.");
      return;
    }
    setSaving(true);
    try {
      const { updateAgentAutomationAction } = await import("@/actions/agent.actions");
      await updateAgentAutomationAction(form);
      toast.success("Otomasi disimpan");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  const masterControls = [
    {
      key: "aiTriageEnabled" as const,
      icon: <RiFlowChart className="size-4" />,
      label: "Triage AI",
      desc: "Klasifikasi modul, prioritas & pencarian KB",
    },
    {
      key: "autoReplyEnabled" as const,
      icon: <RiReplyLine className="size-4" />,
      label: "Balasan Otomatis",
      desc: "AI kirim balasan tanpa intervensi staf",
    },
    {
      key: "aiFirstMode" as const,
      icon: <RiMagicLine className="size-4" />,
      label: "Mode AI-first",
      desc: "Selalu balas meski tidak ada KB cocok",
    },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-6 pb-20">
        <AgentTabIntro
          icon={<RiFlowChart className="size-5" />}
          title="Otomasi & Jadwal"
          description="Kontrol kapan AI membalas tiket, syarat pengirimannya, dan jam operasional."
        >
          <StatusPill on={form.aiTriageEnabled} label={form.aiTriageEnabled ? "Triage aktif" : "Triage mati"} />
          <StatusPill
            on={form.aiTriageEnabled && form.autoReplyEnabled}
            label={
              form.aiTriageEnabled && form.autoReplyEnabled
                ? "Balasan otomatis aktif"
                : "Balasan otomatis mati"
            }
          />
          <StatusPill on={form.aiFirstMode} label={form.aiFirstMode ? "AI-first aktif" : "AI-first mati"} />
          <StatusPill
            on={form.businessHours.enabled}
            label={form.businessHours.enabled ? "Jadwal aktif" : "Selalu aktif"}
          />
        </AgentTabIntro>

        {/* Master controls */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {masterControls.map(({ key, icon, label, desc }) => {
            const on = form[key];
            return (
              <div
                key={key}
                className={cn(
                  "rounded-xl border p-4 transition-colors",
                  on ? "border-primary/20 bg-primary/[0.03]" : "border-border bg-muted/20",
                )}
              >
                <div className="mb-3 flex items-start justify-between">
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg",
                      on ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {icon}
                  </span>
                  <Switch checked={on} onCheckedChange={(v) => set(key, v)} />
                </div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
              </div>
            );
          })}
        </div>

        {/* Klasifikasi */}
        <AgentSection
          icon={<RiFlowChart className="size-4" />}
          title="Klasifikasi"
          description="Cara AI menganalisis dan mengkategorikan tiket yang masuk."
        >
          <Row
            label="Klasifikasi modul otomatis"
            hint="AI menentukan modul tiket saat pertama masuk dan pada follow-up."
          >
            <Switch
              checked={form.autoClassifyModule}
              onCheckedChange={(v) => set("autoClassifyModule", v)}
            />
          </Row>
          <Row
            label="Ambang keyakinan modul"
            hint="Minimum keyakinan (0–1) agar modul ditetapkan. Di bawah ini modul dibiarkan kosong."
          >
            <Input
              type="number"
              step="0.05"
              min={0}
              max={1}
              className="w-24"
              value={form.moduleConfidenceThreshold}
              onChange={(e) => set("moduleConfidenceThreshold", Number(e.target.value))}
            />
          </Row>
          <Row
            label="Rekomendasi prioritas otomatis"
            hint="AI menilai ulang urgensi tiket dari konten pesan."
          >
            <Switch checked={form.autoSetPriority} onCheckedChange={(v) => set("autoSetPriority", v)} />
          </Row>
          <Row
            label="Cari KB lintas modul"
            hint="Cari artikel di semua modul, bukan hanya modul yang terklasifikasi."
          >
            <Switch
              checked={form.kbCrossModuleSearch}
              onCheckedChange={(v) => set("kbCrossModuleSearch", v)}
            />
          </Row>
          <Row
            label="Ambang keyakinan prosedur"
            hint="Minimum keyakinan (0–1) untuk menjalankan prosedur."
          >
            <Input
              type="number"
              step="0.05"
              min={0}
              max={1}
              className="w-24"
              value={form.procedureConfidenceThreshold}
              onChange={(e) => set("procedureConfidenceThreshold", Number(e.target.value))}
            />
          </Row>
          <Row
            label="Penjaga topik (anti off-topic)"
            hint="Tiket jelas di luar topik SIMRS tidak dibalas otomatis."
            bypassed={form.aiFirstMode}
            bypassLabel="Dilewati AI-first"
            bypassHint="AI-first aktif: klarifikasi tetap dikirim meski off-topic. Berlaku untuk balasan KB/prosedur."
          >
            <Switch
              checked={form.offTopicGuardEnabled}
              onCheckedChange={(v) => set("offTopicGuardEnabled", v)}
            />
          </Row>
        </AgentSection>

        {/* Balasan Otomatis */}
        <AgentSection
          icon={<RiReplyLine className="size-4" />}
          title="Balasan Otomatis"
          description="Gerbang dan pengaturan pengiriman balasan otomatis."
        >
          <Row
            label="Wajib didasari artikel KB"
            bypassed={form.aiFirstMode}
            bypassLabel="Dilewati AI-first"
            bypassHint="AI-first aktif: klarifikasi dikirim meski tanpa KB. Berlaku untuk KB/prosedur."
          >
            <Switch
              checked={form.requireKbGrounding}
              onCheckedChange={(v) => set("requireKbGrounding", v)}
            />
          </Row>
          <Row
            label="Ambang keyakinan balasan"
            hint="Minimum keyakinan (0–1) untuk mengirim balasan."
            bypassed={form.aiFirstMode}
            bypassLabel="Dilewati AI-first"
            bypassHint="AI-first aktif: klarifikasi pakai keyakinan 0.9, melewati ambang ini."
          >
            <Input
              type="number"
              step="0.05"
              min={0}
              max={1}
              className="w-24"
              value={form.replyConfidenceThreshold}
              onChange={(e) => set("replyConfidenceThreshold", Number(e.target.value))}
            />
          </Row>
          <Row
            label="Lewati tiket kritis"
            hint="Tiket kritis menunggu staf, tidak dibalas AI secara substantif."
            bypassed={form.aiFirstMode}
            bypassLabel="Dilewati AI-first"
            bypassHint="AI-first aktif: klarifikasi tetap dikirim di tiket kritis. Berlaku untuk KB/prosedur."
          >
            <Switch
              checked={form.skipCriticalPriority}
              onCheckedChange={(v) => set("skipCriticalPriority", v)}
            />
          </Row>
          <Row
            label="Batasi balasan otomatis per tiket"
            hint="AI berhenti membalas otomatis setelah mencapai batas per tiket."
            bypassed={form.aiFirstMode}
            bypassLabel="Dilewati AI-first"
            bypassHint="AI-first aktif: klarifikasi tidak terhitung dalam batas ini."
          >
            <Switch
              checked={form.limitAutoRepliesPerTicket}
              onCheckedChange={(v) => set("limitAutoRepliesPerTicket", v)}
            />
          </Row>
          {form.limitAutoRepliesPerTicket && (
            <Row label="Batas maksimum">
              <Input
                type="number"
                min={1}
                className="w-24"
                value={form.maxAutoRepliesPerTicket}
                onChange={(e) => set("maxAutoRepliesPerTicket", Number(e.target.value))}
              />
            </Row>
          )}
          <Row
            label="Tunda kirim (menit)"
            hint="Staf dapat mengambil alih sebelum AI mengirim. 0 = langsung."
          >
            <Input
              type="number"
              min={0}
              className="w-24"
              value={form.autoReplyDelayMinutes}
              onChange={(e) => set("autoReplyDelayMinutes", Number(e.target.value))}
            />
          </Row>

          <div className="py-3">
            <p className="mb-1.5 text-sm font-medium">Kanal aktif</p>
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map((ch) => {
                const on = form.autoReplyChannels.includes(ch);
                return (
                  <button
                    key={ch}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleChannel(ch)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                      on
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {ch}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="py-3">
            <p className="mb-1.5 text-sm font-medium">Kata kunci diblokir</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {form.blockedKeywords.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                >
                  {k}
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "blockedKeywords",
                        form.blockedKeywords.filter((x) => x !== k),
                      )
                    }
                    aria-label={`Hapus ${k}`}
                  >
                    <RiCloseLine className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={keywordDraft}
                onChange={(e) => setKeywordDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                placeholder="Tambah kata kunci…"
                className="max-w-xs"
              />
              <Button type="button" variant="outline" onClick={addKeyword}>
                Tambah
              </Button>
            </div>
          </div>
        </AgentSection>

        {/* Jadwal */}
        <AgentSection
          icon={<RiCalendarScheduleLine className="size-4" />}
          title="Jadwal"
          description="Batasi kapan AI boleh mengirim balasan otomatis."
        >
          <Row
            label="Aktifkan jadwal operasional"
            hint="Di luar jendela yang ditentukan, balasan hanya disimpan sebagai draf."
          >
            <Switch
              checked={form.businessHours.enabled}
              onCheckedChange={(v) => setHours({ enabled: v })}
            />
          </Row>
          <Row
            label="Pesan otomatis di luar jam"
            hint="Kirim 1 pemberitahuan ke pelapor saat di luar jam, lalu draf disimpan untuk staf."
          >
            <Switch
              checked={form.offHoursReplyEnabled}
              onCheckedChange={(v) => set("offHoursReplyEnabled", v)}
            />
          </Row>
          {form.offHoursReplyEnabled && (
            <div className="space-y-1.5 py-3">
              <Label htmlFor="offHoursMessage">Isi pesan di luar jam</Label>
              <Textarea
                id="offHoursMessage"
                className="min-h-[80px]"
                value={form.offHoursMessage}
                onChange={(e) => set("offHoursMessage", e.target.value)}
                placeholder="Terima kasih telah menghubungi kami. Saat ini di luar jam operasional…"
              />
              <p className="text-xs text-muted-foreground">
                Dikirim maksimal sekali per tiket agar tidak spam.
              </p>
            </div>
          )}

          {form.businessHours.enabled && (
            <div className="space-y-3 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tz">Zona waktu</Label>
                  <Input
                    id="tz"
                    value={form.businessHours.timezone}
                    onChange={(e) => setHours({ timezone: e.target.value })}
                    placeholder="Asia/Jakarta"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="defmode">Mode di luar jendela</Label>
                  <select
                    id="defmode"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.businessHours.defaultMode}
                    onChange={(e) => setHours({ defaultMode: e.target.value as ReplyMode })}
                  >
                    <option value="auto">Balas otomatis</option>
                    <option value="draft-only">Hanya draf</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                {windows.map((w, i) => (
                  <div key={i} className="space-y-2 rounded-lg border p-3">
                    <div className="flex flex-wrap gap-1">
                      {DAYS.map((d) => {
                        const on = w.days.includes(d.value);
                        return (
                          <button
                            key={d.value}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              updateWindow(i, {
                                days: on
                                  ? w.days.filter((x) => x !== d.value)
                                  : [...w.days, d.value],
                              })
                            }
                            className={cn(
                              "rounded-md border px-2 py-1 text-xs transition-colors",
                              on
                                ? "border-foreground bg-foreground text-background"
                                : "border-border text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="time"
                        className="w-32"
                        value={w.start}
                        onChange={(e) => updateWindow(i, { start: e.target.value })}
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        className="w-32"
                        value={w.end}
                        onChange={(e) => updateWindow(i, { end: e.target.value })}
                      />
                      <select
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={w.mode}
                        onChange={(e) => updateWindow(i, { mode: e.target.value as ReplyMode })}
                      >
                        <option value="auto">Balas otomatis</option>
                        <option value="draft-only">Hanya draf</option>
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setHours({ windows: windows.filter((_, idx) => idx !== i) })}
                        aria-label="Hapus jendela"
                      >
                        <RiCloseLine className="size-4" />
                      </Button>
                    </div>
                    {w.start >= w.end && (
                      <p className="text-xs text-destructive">
                        Jam mulai harus sebelum jam selesai (jendela lintas tengah malam belum
                        didukung).
                      </p>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addWindow}>
                  <RiAddLine className="size-4" /> Tambah jendela
                </Button>
              </div>
            </div>
          )}
        </AgentSection>

        <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t bg-background/80 px-1 py-3 backdrop-blur">
          {invalidWindow && (
            <span className="text-xs text-destructive">Periksa jendela jadwal sebelum menyimpan.</span>
          )}
          <Button onClick={handleSave} disabled={saving || invalidWindow}>
            {saving ? "Menyimpan…" : "Simpan perubahan"}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
