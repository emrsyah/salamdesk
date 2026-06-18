"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RiAddLine, RiDeleteBinLine, RiPencilLine, RiListOrdered2 } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ProcedureEditor } from "@/components/agent/procedure-editor/procedure-editor";
import { ProcedureReadonly } from "@/components/agent/procedure-editor/procedure-readonly";
import { emptyProcedureContent, type ProcedureContent } from "@/lib/agent/procedure-content";
import type { MentionSource } from "@/services/agent-mention-sources.service";
import { AgentTabIntro, StatusPill } from "./agent-ui";

type Procedure = {
  id: string;
  title: string;
  whenToUse: string;
  content: ProcedureContent;
  enabled: boolean;
  order: number;
};

type Draft = {
  id: string | null;
  title: string;
  whenToUse: string;
  content: ProcedureContent;
  enabled: boolean;
  order: number;
};

function toDraft(p: Procedure | null): Draft {
  return p
    ? { id: p.id, title: p.title, whenToUse: p.whenToUse, content: p.content, enabled: p.enabled, order: p.order }
    : { id: null, title: "", whenToUse: "", content: emptyProcedureContent(), enabled: true, order: 0 };
}

export function ProceduresClient({ procedures, sources }: { procedures: Procedure[]; sources: MentionSource[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  async function toggleEnabled(p: Procedure, enabled: boolean) {
    try {
      const { updateProcedureAction } = await import("@/actions/agent.actions");
      await updateProcedureAction(p.id, { enabled });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memperbarui");
    }
  }

  async function remove(p: Procedure) {
    if (!confirm(`Hapus prosedur "${p.title}"?`)) return;
    try {
      const { deleteProcedureAction } = await import("@/actions/agent.actions");
      await deleteProcedureAction(p.id);
      toast.success("Prosedur dihapus");
      if (draft?.id === p.id) setDraft(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus");
    }
  }

  async function save() {
    if (!draft) return;
    if (!draft.title.trim()) {
      toast.error("Judul prosedur wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const actions = await import("@/actions/agent.actions");
      const payload = {
        title: draft.title,
        whenToUse: draft.whenToUse,
        content: draft.content,
        enabled: draft.enabled,
        order: draft.order,
      };
      if (draft.id) await actions.updateProcedureAction(draft.id, payload);
      else await actions.createProcedureAction(payload);
      toast.success("Prosedur disimpan");
      setDraft(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  // Editing panel
  if (draft) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{draft.id ? "Edit prosedur" : "Prosedur baru"}</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="proc-title">Judul</Label>
          <Input
            id="proc-title"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="mis. Pesanan makanan rusak"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="proc-when">Kapan prosedur ini dipakai</Label>
          <Textarea
            id="proc-when"
            value={draft.whenToUse}
            onChange={(e) => setDraft({ ...draft, whenToUse: e.target.value })}
            placeholder="Gunakan ini jika pelapor melaporkan pesanan rusak (mis. tumpah, bocor, kemasan penyok)…"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            AI mencocokkan tiket ke prosedur berdasarkan deskripsi ini.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Langkah-langkah</Label>
          <ProcedureEditor
            value={draft.content}
            onChange={(content) => setDraft({ ...draft, content })}
            sources={sources}
            onCreateTool={() => router.push("/app/agent/tools")}
            onCreateKb={() => router.push("/app/knowledge")}
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch id="proc-enabled" checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} />
          <Label htmlFor="proc-enabled">Aktif</Label>
        </div>
      </div>
    );
  }

  // List
  const enabledCount = procedures.filter((p) => p.enabled).length;

  return (
    <div className="space-y-4">
      <AgentTabIntro
        icon={<RiListOrdered2 className="size-5" />}
        title="Prosedur"
        description="Playbook langkah-demi-langkah yang diikuti agen ketika tiket cocok dengan deskripsi “kapan dipakai”. Prosedur dapat memanggil Tools dan merujuk artikel KB; balasannya tetap memakai persona dari tab Perilaku."
      >
        <StatusPill on={enabledCount > 0} label={`${enabledCount}/${procedures.length} aktif`} />
      </AgentTabIntro>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Daftar prosedur</p>
        <Button onClick={() => setDraft(toDraft(null))}>
          <RiAddLine className="mr-1 size-4" /> Tambah prosedur
        </Button>
      </div>

      {procedures.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Belum ada prosedur. Tambahkan satu agar agen AI mengikuti langkah spesifik untuk skenario tertentu.
        </div>
      ) : (
        <ul className="space-y-2">
          {procedures.map((p) => (
            <li key={p.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.title}</span>
                    {!p.enabled && <Badge variant="secondary">Nonaktif</Badge>}
                  </div>
                  {p.whenToUse && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{p.whenToUse}</p>}
                  <div className="mt-2 line-clamp-3 opacity-80">
                    <ProcedureReadonly content={p.content} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Switch checked={p.enabled} onCheckedChange={(v) => toggleEnabled(p, v)} aria-label="Aktif" />
                  <Button variant="ghost" size="icon" onClick={() => setDraft(toDraft(p))} aria-label="Edit">
                    <RiPencilLine className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(p)} aria-label="Hapus">
                    <RiDeleteBinLine className="size-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
