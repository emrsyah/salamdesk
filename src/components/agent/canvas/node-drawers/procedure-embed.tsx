"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ProceduresClient } from "@/components/agent/procedures-client";
import { updateAgentAutomationAction } from "@/actions/agent.actions";
import type { ProcedureContent } from "@/lib/agent/procedure-content";
import type { MentionSource } from "@/services/agent-mention-sources.service";
import { SettingRow } from "../../agent-ui";

type Procedure = {
  id: string;
  title: string;
  whenToUse: string;
  content: ProcedureContent;
  enabled: boolean;
  order: number;
};

/**
 * The procedure node's full inline editor: the confidence threshold (the one
 * config knob the step list doesn't own) sits above the reused, self-saving
 * `ProceduresClient` — which brings the rich `ProcedureEditor` leaf, the enable
 * toggle, and per-step CRUD. The threshold saves on blur so this whole drawer
 * needs no footer.
 */
export function ProcedureEmbed({
  procedures,
  sources,
  proceduresEnabled,
  procedureConfidenceThreshold,
}: {
  procedures: Procedure[];
  sources: MentionSource[];
  proceduresEnabled: boolean;
  procedureConfidenceThreshold: number;
}) {
  const router = useRouter();
  const [threshold, setThreshold] = useState(procedureConfidenceThreshold);
  const [saving, setSaving] = useState(false);

  async function saveThreshold() {
    if (threshold === procedureConfidenceThreshold) return;
    setSaving(true);
    try {
      await updateAgentAutomationAction({ procedureConfidenceThreshold: threshold });
      toast.success("Ambang prosedur disimpan");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="divide-y rounded-xl border px-4">
        <SettingRow
          label="Ambang keyakinan prosedur"
          hint="Minimum keyakinan (0–1) untuk menjalankan prosedur. Disimpan otomatis."
        >
          <Input
            type="number"
            step="0.05"
            min={0}
            max={1}
            className="w-24"
            disabled={saving}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            onBlur={saveThreshold}
          />
        </SettingRow>
      </div>

      <ProceduresClient procedures={procedures} sources={sources} proceduresEnabled={proceduresEnabled} />
    </div>
  );
}
