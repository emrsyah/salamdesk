"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { AiConfig, AiConfigUpdate } from "@/services/ai-config.service";
import { SettingRow } from "../../agent-ui";
import type { RegisterFn } from ".";

/**
 * The lightweight automation-stage editors (module, priority, guard, KB,
 * procedure). Each owns a small slice of the config and persists via
 * `updateAgentAutomationAction`. They share the gate's `register`-on-render
 * contract; none has cross-field validation, so they always report valid.
 */

const BYPASS = {
  bypassLabel: "Dilewati AI-first",
  bypassHint:
    "Mode AI-first aktif: klarifikasi tetap dikirim, melewati syarat ini. Berlaku untuk balasan KB/prosedur.",
} as const;

type DrawerProps = { config: AiConfig; register: RegisterFn };

/** Threshold input shared by the module/procedure editors. */
function Threshold({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Input
      type="number"
      step="0.05"
      min={0}
      max={1}
      className="w-24"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export function ModuleDrawer({ config, register }: DrawerProps) {
  const [form, setForm] = useState({
    autoClassifyModule: config.autoClassifyModule,
    moduleConfidenceThreshold: config.moduleConfidenceThreshold,
  });
  register(() => ({ ...form }) satisfies AiConfigUpdate, false);
  return (
    <div className="divide-y rounded-xl border px-4">
      <SettingRow
        label="Klasifikasi modul otomatis"
        hint="AI menentukan modul tiket saat pertama masuk dan pada follow-up."
      >
        <Switch
          checked={form.autoClassifyModule}
          onCheckedChange={(v) => setForm((f) => ({ ...f, autoClassifyModule: v }))}
        />
      </SettingRow>
      <SettingRow
        label="Ambang keyakinan modul"
        hint="Minimum keyakinan (0–1) agar modul ditetapkan. Di bawah ini modul dibiarkan kosong."
      >
        <Threshold
          value={form.moduleConfidenceThreshold}
          onChange={(v) => setForm((f) => ({ ...f, moduleConfidenceThreshold: v }))}
        />
      </SettingRow>
    </div>
  );
}

export function PriorityDrawer({ config, register }: DrawerProps) {
  const [autoSetPriority, setValue] = useState(config.autoSetPriority);
  register(() => ({ autoSetPriority }), false);
  return (
    <div className="divide-y rounded-xl border px-4">
      <SettingRow
        label="Rekomendasi prioritas otomatis"
        hint="AI menilai ulang urgensi tiket dari konten pesan."
      >
        <Switch checked={autoSetPriority} onCheckedChange={setValue} />
      </SettingRow>
    </div>
  );
}

export function GuardDrawer({ config, register }: DrawerProps) {
  const [offTopicGuardEnabled, setValue] = useState(config.offTopicGuardEnabled);
  register(() => ({ offTopicGuardEnabled }), false);
  return (
    <div className="space-y-4">
      {config.aiFirstMode && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          Mode AI-first aktif — penjaga topik dilewati untuk balasan klarifikasi.
        </p>
      )}
      <div className="divide-y rounded-xl border px-4">
        <SettingRow
          label="Penjaga topik (anti off-topic)"
          hint="Tiket jelas di luar topik SIMRS tidak dibalas otomatis."
          bypassed={config.aiFirstMode}
          {...BYPASS}
        >
          <Switch checked={offTopicGuardEnabled} onCheckedChange={setValue} />
        </SettingRow>
      </div>
    </div>
  );
}

export function KbDrawer({ config, register }: DrawerProps) {
  const [kbCrossModuleSearch, setValue] = useState(config.kbCrossModuleSearch);
  register(() => ({ kbCrossModuleSearch }), false);
  return (
    <div className="divide-y rounded-xl border px-4">
      <SettingRow
        label="Cari KB lintas modul"
        hint="Cari artikel di semua modul, bukan hanya modul yang terklasifikasi."
      >
        <Switch checked={kbCrossModuleSearch} onCheckedChange={setValue} />
      </SettingRow>
    </div>
  );
}

// The procedure node uses a full embed editor (ProcedureEmbed) rather than a
// form group, so it can host the rich step editor inline — see node-drawers/index.
