"use client";

import { useState } from "react";
import { RiAddLine, RiCloseLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { BusinessHours, ReplyMode } from "@/lib/agent/business-hours";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/agent/business-hours";
import type { AiConfig, AiConfigUpdate } from "@/services/ai-config.service";
import { SettingRow } from "../../agent-ui";

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

/** Fields the gate node owns. Auto-reply ON/OFF lives in the canvas toolbar. */
type GateForm = Pick<
  AiConfig,
  | "replyConfidenceThreshold"
  | "skipCriticalPriority"
  | "requireKbGrounding"
  | "limitAutoRepliesPerTicket"
  | "maxAutoRepliesPerTicket"
  | "autoReplyDelayMinutes"
  | "autoReplyChannels"
  | "blockedKeywords"
  | "businessHours"
  | "offHoursReplyEnabled"
  | "offHoursMessage"
>;

const BYPASS = {
  bypassLabel: "Dilewati AI-first",
  bypassHint:
    "Mode AI-first aktif: klarifikasi tetap dikirim, melewati syarat ini. Berlaku untuk balasan KB/prosedur.",
} as const;

/**
 * Editor for the auto-reply gate — the stage with the most knobs. Rebuilt
 * canvas-native (bespoke layout, reusing the `SettingRow` leaf for its AI-first
 * bypass affordance). Returns the partial update via `register`; the shell
 * persists it with `updateAgentAutomationAction`.
 */
export function GateDrawer({
  config,
  register,
}: {
  config: AiConfig;
  /** Hand the shell a thunk that returns this node's partial update. */
  register: (getUpdate: () => AiConfigUpdate, invalid: boolean) => void;
}) {
  const aiFirst = config.aiFirstMode;
  const [form, setForm] = useState<GateForm>({
    replyConfidenceThreshold: config.replyConfidenceThreshold,
    skipCriticalPriority: config.skipCriticalPriority,
    requireKbGrounding: config.requireKbGrounding,
    limitAutoRepliesPerTicket: config.limitAutoRepliesPerTicket,
    maxAutoRepliesPerTicket: config.maxAutoRepliesPerTicket,
    autoReplyDelayMinutes: config.autoReplyDelayMinutes,
    autoReplyChannels: config.autoReplyChannels,
    blockedKeywords: config.blockedKeywords,
    businessHours: config.businessHours ?? DEFAULT_BUSINESS_HOURS,
    offHoursReplyEnabled: config.offHoursReplyEnabled,
    offHoursMessage: config.offHoursMessage,
  });
  const [keywordDraft, setKeywordDraft] = useState("");

  const set = <K extends keyof GateForm>(key: K, value: GateForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setHours = (patch: Partial<BusinessHours>) =>
    setForm((f) => ({ ...f, businessHours: { ...f.businessHours, ...patch } }));

  const windows = form.businessHours.windows;
  const invalidWindow = windows.some((w) => w.start >= w.end);

  // Re-register on every render so the shell always reads the latest form.
  register(() => ({ ...form }), invalidWindow);

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

  const updateWindow = (i: number, patch: Partial<BusinessHours["windows"][number]>) =>
    setHours({ windows: windows.map((w, idx) => (idx === i ? { ...w, ...patch } : w)) });
  const addWindow = () =>
    setHours({
      windows: [...windows, { days: [1, 2, 3, 4, 5], start: "08:00", end: "17:00", mode: "draft-only" }],
    });

  return (
    <div className="space-y-5">
      {aiFirst && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          Mode AI-first aktif — beberapa syarat di bawah dilewati untuk balasan klarifikasi.
        </p>
      )}

      {/* Gate criteria */}
      <div className="divide-y rounded-xl border px-4">
        <SettingRow
          label="Wajib didasari artikel KB"
          bypassed={aiFirst}
          {...BYPASS}
        >
          <Switch checked={form.requireKbGrounding} onCheckedChange={(v) => set("requireKbGrounding", v)} />
        </SettingRow>
        <SettingRow
          label="Ambang keyakinan balasan"
          hint="Minimum keyakinan (0–1) untuk mengirim balasan."
          bypassed={aiFirst}
          {...BYPASS}
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
        </SettingRow>
        <SettingRow
          label="Lewati tiket kritis"
          hint="Tiket kritis menunggu staf, tidak dibalas AI secara substantif."
          bypassed={aiFirst}
          {...BYPASS}
        >
          <Switch checked={form.skipCriticalPriority} onCheckedChange={(v) => set("skipCriticalPriority", v)} />
        </SettingRow>
        <SettingRow
          label="Batasi balasan otomatis per tiket"
          hint="AI berhenti membalas otomatis setelah mencapai batas per tiket."
          bypassed={aiFirst}
          {...BYPASS}
        >
          <Switch
            checked={form.limitAutoRepliesPerTicket}
            onCheckedChange={(v) => set("limitAutoRepliesPerTicket", v)}
          />
        </SettingRow>
        {form.limitAutoRepliesPerTicket && (
          <SettingRow label="Batas maksimum">
            <Input
              type="number"
              min={1}
              className="w-24"
              value={form.maxAutoRepliesPerTicket}
              onChange={(e) => set("maxAutoRepliesPerTicket", Number(e.target.value))}
            />
          </SettingRow>
        )}
        <SettingRow
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
        </SettingRow>
      </div>

      {/* Channels */}
      <div>
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

      {/* Blocked keywords */}
      <div>
        <p className="mb-1.5 text-sm font-medium">Kata kunci diblokir</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {form.blockedKeywords.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
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

      {/* Schedule */}
      <div className="space-y-3 rounded-xl border p-4">
        <p className="text-sm font-semibold">Jadwal operasional</p>
        <SettingRow
          label="Aktifkan jadwal"
          hint="Di luar jendela yang ditentukan, balasan hanya disimpan sebagai draf."
        >
          <Switch
            checked={form.businessHours.enabled}
            onCheckedChange={(v) => setHours({ enabled: v })}
          />
        </SettingRow>
        <SettingRow
          label="Pesan otomatis di luar jam"
          hint="Kirim 1 pemberitahuan ke pelapor saat di luar jam, lalu draf disimpan."
        >
          <Switch
            checked={form.offHoursReplyEnabled}
            onCheckedChange={(v) => set("offHoursReplyEnabled", v)}
          />
        </SettingRow>
        {form.offHoursReplyEnabled && (
          <div className="space-y-1.5">
            <Label htmlFor="offHoursMessage">Isi pesan di luar jam</Label>
            <Textarea
              id="offHoursMessage"
              className="min-h-[72px]"
              value={form.offHoursMessage}
              onChange={(e) => set("offHoursMessage", e.target.value)}
              placeholder="Terima kasih telah menghubungi kami…"
            />
          </div>
        )}

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
                  <p className="text-xs text-destructive">Jam mulai harus sebelum jam selesai.</p>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addWindow}>
              <RiAddLine className="size-4" /> Tambah jendela
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
