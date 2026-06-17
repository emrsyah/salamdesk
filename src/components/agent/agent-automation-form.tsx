"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RiAddLine, RiCloseLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { BusinessHours, ReplyMode } from "@/lib/agent/business-hours";

type AutomationConfig = {
  aiTriageEnabled: boolean;
  autoClassifyModule: boolean;
  moduleConfidenceThreshold: number;
  autoSetPriority: boolean;
  autoReplyEnabled: boolean;
  replyConfidenceThreshold: number;
  autoReplyDelayMinutes: number;
  autoReplyChannels: string[];
  skipCriticalPriority: boolean;
  requireKbGrounding: boolean;
  blockedKeywords: string[];
  maxAutoRepliesPerTicket: number;
  businessHours: BusinessHours;
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

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

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
      windows: [...windows, { days: [1, 2, 3, 4, 5], start: "08:00", end: "17:00", mode: "draft-only" }],
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

  return (
    <div className="space-y-8">
      {/* Triage */}
      <section className="space-y-1 rounded-xl border p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Otomasi Triage
        </h2>
        <Row label="Aktifkan triage AI" hint="Master switch untuk seluruh pipeline AI.">
          <Switch checked={form.aiTriageEnabled} onCheckedChange={(v) => set("aiTriageEnabled", v)} />
        </Row>
        <Row label="Klasifikasi modul otomatis">
          <Switch checked={form.autoClassifyModule} onCheckedChange={(v) => set("autoClassifyModule", v)} />
        </Row>
        <Row label="Ambang keyakinan modul" hint="0–1; di bawah ini modul dibiarkan kosong.">
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
        <Row label="Rekomendasi prioritas otomatis">
          <Switch checked={form.autoSetPriority} onCheckedChange={(v) => set("autoSetPriority", v)} />
        </Row>
      </section>

      {/* Auto-reply */}
      <section className="space-y-1 rounded-xl border p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Balasan Otomatis
        </h2>
        <Row label="Aktifkan balasan otomatis">
          <Switch checked={form.autoReplyEnabled} onCheckedChange={(v) => set("autoReplyEnabled", v)} />
        </Row>
        <Row label="Ambang keyakinan balasan" hint="0–1.">
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
        <Row label="Tunda kirim (menit)" hint="Beri jeda agar staf bisa mengambil alih. 0 = langsung.">
          <Input
            type="number"
            min={0}
            className="w-24"
            value={form.autoReplyDelayMinutes}
            onChange={(e) => set("autoReplyDelayMinutes", Number(e.target.value))}
          />
        </Row>
        <Row label="Maks balasan per tiket">
          <Input
            type="number"
            min={1}
            className="w-24"
            value={form.maxAutoRepliesPerTicket}
            onChange={(e) => set("maxAutoRepliesPerTicket", Number(e.target.value))}
          />
        </Row>
        <Row label="Lewati tiket kritis">
          <Switch checked={form.skipCriticalPriority} onCheckedChange={(v) => set("skipCriticalPriority", v)} />
        </Row>
        <Row label="Wajib didasari artikel KB">
          <Switch checked={form.requireKbGrounding} onCheckedChange={(v) => set("requireKbGrounding", v)} />
        </Row>

        <div className="pt-2">
          <p className="mb-1.5 text-sm font-medium">Kanal yang boleh dibalas otomatis</p>
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

        <div className="pt-3">
          <p className="mb-1.5 text-sm font-medium">Kata kunci yang diblokir</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {form.blockedKeywords.map((k) => (
              <span
                key={k}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
              >
                {k}
                <button
                  type="button"
                  onClick={() => set("blockedKeywords", form.blockedKeywords.filter((x) => x !== k))}
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
      </section>

      {/* Schedule */}
      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Jadwal (Jam Operasional)
        </h2>
        <Row label="Aktifkan jadwal" hint="Batasi kapan balasan otomatis boleh dikirim.">
          <Switch
            checked={form.businessHours.enabled}
            onCheckedChange={(v) => setHours({ enabled: v })}
          />
        </Row>

        {form.businessHours.enabled && (
          <div className="space-y-3">
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
                              days: on ? w.days.filter((x) => x !== d.value) : [...w.days, d.value],
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
                      Jam mulai harus sebelum jam selesai (jendela lintas tengah malam belum didukung).
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
      </section>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || invalidWindow}>
          {saving ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </div>
  );
}
