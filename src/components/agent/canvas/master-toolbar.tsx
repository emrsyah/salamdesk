"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RiFlowChart, RiReplyLine, RiMagicLine } from "@remixicon/react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { updateAgentAutomationAction } from "@/actions/agent.actions";
import type { AiConfig } from "@/services/ai-config.service";

type MasterKey = "aiTriageEnabled" | "autoReplyEnabled" | "aiFirstMode";

const SWITCHES: { key: MasterKey; icon: React.ReactNode; label: string; hint: string }[] = [
  { key: "aiTriageEnabled", icon: <RiFlowChart className="size-4" />, label: "Triage AI", hint: "Mesin utama — klasifikasi, prioritas, KB" },
  { key: "autoReplyEnabled", icon: <RiReplyLine className="size-4" />, label: "Balasan Otomatis", hint: "AI mengirim balasan tanpa staf" },
  { key: "aiFirstMode", icon: <RiMagicLine className="size-4" />, label: "Mode AI-first", hint: "Selalu balas meski tak ada KB cocok" },
];

/**
 * The three pipeline-wide master switches, pinned above the graph. Each toggle
 * persists immediately via a partial config update (these are global modes, not
 * a single stage's settings — so they live in the chrome, not a node drawer).
 */
export function MasterToolbar({ config }: { config: AiConfig }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const toggle = (key: MasterKey, value: boolean) =>
    startTransition(async () => {
      try {
        await updateAgentAutomationAction({ [key]: value });
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal menyimpan");
      }
    });

  return (
    <div className="flex flex-wrap gap-2">
      {SWITCHES.map(({ key, icon, label, hint }) => {
        // Auto-reply is moot when triage is off — reflect that visually.
        const dependentOff = key === "autoReplyEnabled" && !config.aiTriageEnabled;
        const on = config[key] && !dependentOff;
        return (
          <div
            key={key}
            className={cn(
              "flex min-w-[200px] flex-1 items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
              on ? "border-primary/20 bg-primary/[0.03]" : "border-border bg-muted/20",
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                on ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">{label}</p>
              <p className="truncate text-xs text-muted-foreground">{hint}</p>
            </div>
            <Switch
              checked={config[key]}
              disabled={pending}
              onCheckedChange={(v) => toggle(key, v)}
              aria-label={label}
            />
          </div>
        );
      })}
    </div>
  );
}
