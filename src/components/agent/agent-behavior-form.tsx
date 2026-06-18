"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  RiUser3Line,
  RiChatSmile3Line,
  RiShieldKeyholeLine,
  RiQuillPenLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AgentTabIntro, AgentSection } from "./agent-ui";

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
    <div className="space-y-6 pb-20">
      <AgentTabIntro
        icon={<RiChatSmile3Line className="size-5" />}
        title="Perilaku & Suara"
        description="Menentukan siapa agen ini dan bagaimana ia berbicara. Pengaturan ini dipakai saat AI menyusun balasan dari Knowledge Base maupun saat menjalankan Prosedur."
      />

      <AgentSection
        icon={<RiUser3Line className="size-4" />}
        title="Identitas"
        description="Nama yang muncul di balasan dan bahasa default agen."
      >
        <div className="grid gap-4 py-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="agentName">Nama agen</Label>
            <Input
              id="agentName"
              value={form.agentName}
              onChange={(e) => set("agentName", e.target.value)}
              placeholder="Asisten"
            />
            <p className="text-xs text-muted-foreground">Dipakai sebagai sapaan/identitas di percakapan.</p>
          </div>
          <div className="space-y-1.5">
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
            <p className="text-xs text-muted-foreground">Bahasa utama yang dipakai untuk membalas.</p>
          </div>
        </div>
      </AgentSection>

      <AgentSection
        icon={<RiChatSmile3Line className="size-4" />}
        title="Persona & Gaya"
        description="Karakter dan nada bicara agen ketika menjawab pelapor."
      >
        <div className="space-y-2 py-4">
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
        <div className="space-y-2 py-4">
          <Label htmlFor="tone">Gaya bahasa (tone)</Label>
          <Input
            id="tone"
            value={form.tone}
            onChange={(e) => set("tone", e.target.value)}
            placeholder="Contoh: ramah, ringkas, profesional"
          />
          <p className="text-xs text-muted-foreground">Beberapa kata sifat singkat sudah cukup.</p>
        </div>
      </AgentSection>

      <AgentSection
        icon={<RiShieldKeyholeLine className="size-4" />}
        title="Batasan"
        description="Aturan yang tidak boleh dilanggar agen dalam keadaan apa pun."
      >
        <div className="space-y-2 py-4">
          <Label htmlFor="guardrails">Guardrails</Label>
          <Textarea
            id="guardrails"
            className="min-h-[90px]"
            value={form.guardrails}
            onChange={(e) => set("guardrails", e.target.value)}
            placeholder="Contoh: Jangan pernah memberi nasihat medis. Jangan janjikan SLA tertentu."
          />
          <p className="text-xs text-muted-foreground">
            Tuliskan larangan secara eksplisit. Agen akan menghindari hal-hal ini.
          </p>
        </div>
      </AgentSection>

      <AgentSection
        icon={<RiQuillPenLine className="size-4" />}
        title="Tanda Tangan"
        description="Teks penutup yang otomatis ditambahkan di akhir balasan."
      >
        <div className="space-y-2 py-4">
          <Label htmlFor="replySignature">Tanda tangan balasan</Label>
          <Input
            id="replySignature"
            value={form.replySignature}
            onChange={(e) => set("replySignature", e.target.value)}
            placeholder="Contoh: — Tim Support SIMRS"
          />
          <p className="text-xs text-muted-foreground">Kosongkan jika tidak ingin menambahkan tanda tangan.</p>
        </div>
      </AgentSection>

      <div className="sticky bottom-0 -mx-1 flex justify-end gap-2 border-t bg-background/80 px-1 py-3 backdrop-blur">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Menyimpan…" : "Simpan perubahan"}
        </Button>
      </div>
    </div>
  );
}
