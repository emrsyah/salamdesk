"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Behavior = {
  agentName: string;
  persona: string;
  tone: string;
  language: string;
  replySignature: string;
  guardrails: string;
};

export function AgentBehaviorForm({ config }: { config: Behavior }) {
  const router = useRouter();
  const [form, setForm] = useState<Behavior>(config);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Behavior>(key: K, value: Behavior[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSave() {
    setSaving(true);
    try {
      const { updateAgentBehaviorAction } = await import("@/actions/agent.actions");
      await updateAgentBehaviorAction(form);
      toast.success("Perilaku agen disimpan");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="agentName">Nama agen</Label>
          <Input
            id="agentName"
            value={form.agentName}
            onChange={(e) => set("agentName", e.target.value)}
            placeholder="Asisten"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="language">Bahasa</Label>
          <select
            id="language"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            value={form.language}
            onChange={(e) => set("language", e.target.value)}
          >
            <option value="id">Bahasa Indonesia</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="persona">Persona / peran</Label>
        <Textarea
          id="persona"
          className="min-h-[120px]"
          value={form.persona}
          onChange={(e) => set("persona", e.target.value)}
          placeholder="Contoh: Kamu adalah asisten support SIMRS RSUD Karawang yang membantu staf rumah sakit…"
        />
        <p className="text-xs text-muted-foreground">
          Instruksi dasar yang menentukan siapa agen ini dan bagaimana ia menjawab.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tone">Gaya bahasa (tone)</Label>
        <Input
          id="tone"
          value={form.tone}
          onChange={(e) => set("tone", e.target.value)}
          placeholder="Contoh: ramah, ringkas, profesional"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="guardrails">Batasan (guardrails)</Label>
        <Textarea
          id="guardrails"
          className="min-h-[90px]"
          value={form.guardrails}
          onChange={(e) => set("guardrails", e.target.value)}
          placeholder="Contoh: Jangan pernah memberi nasihat medis. Jangan janjikan SLA tertentu."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="replySignature">Tanda tangan balasan</Label>
        <Input
          id="replySignature"
          value={form.replySignature}
          onChange={(e) => set("replySignature", e.target.value)}
          placeholder="Contoh: — Tim Support SIMRS"
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </div>
  );
}
