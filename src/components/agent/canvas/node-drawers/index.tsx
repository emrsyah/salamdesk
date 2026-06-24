"use client";

import { useCallback, useRef, type ComponentType, type ReactNode } from "react";
import { updateAgentAutomationAction } from "@/actions/agent.actions";
import type { PipelineNodeId } from "@/lib/agent/pipeline-topology";
import type { AiConfig, AiConfigUpdate } from "@/services/ai-config.service";
import { AgentToolsClient } from "@/components/agent/agent-tools-client";
import { AgentBehaviorForm } from "@/components/agent/agent-behavior-form";
import { FormDrawer, DrawerFrame } from "./drawer-shell";
import { GateDrawer } from "./gate-drawer";
import { ProcedureEmbed } from "./procedure-embed";
import { ModuleDrawer, PriorityDrawer, GuardDrawer, KbDrawer } from "./automation-drawers";
import type { CanvasEmbedData } from "../canvas-data";

/** A node editor body reports its current partial update via `register`. */
export type RegisterFn = (getUpdate: () => AiConfigUpdate, invalid: boolean) => void;

/** What an embed editor renders from: the config plus server-fetched list data. */
export interface EmbedContext {
  config: AiConfig;
  data: CanvasEmbedData;
}

/** Form-kind: a bespoke field group that reports a partial update to save. */
interface FormEditorDef {
  kind: "form";
  icon: string;
  title: string;
  description: string;
  Body: ComponentType<{ config: AiConfig; register: RegisterFn }>;
  persist: (update: AiConfigUpdate) => Promise<unknown>;
  invalidMessage?: string;
}

/**
 * Embed-kind: a self-saving editor (the reused tab components). Its data comes
 * from server props so the embedded component's `router.refresh()` reloads it.
 */
interface EmbedEditorDef {
  kind: "embed";
  icon: string;
  title: string;
  description: string;
  render: (ctx: EmbedContext) => ReactNode;
}

type NodeEditorDef = FormEditorDef | EmbedEditorDef;

const automation = (
  icon: string,
  title: string,
  description: string,
  Body: FormEditorDef["Body"],
  invalidMessage?: string,
): FormEditorDef => ({
  kind: "form",
  icon,
  title,
  description,
  Body,
  persist: (u) => updateAgentAutomationAction(u),
  invalidMessage,
});

/**
 * Registry of which stage nodes are editable and how. A node absent here is not
 * clickable on the canvas (no empty drawers). Form editors are bespoke field
 * groups; embed editors reuse the existing self-saving tab components.
 */
export const NODE_EDITORS: Partial<Record<PipelineNodeId, NodeEditorDef>> = {
  module: automation("🎯", "Klasifikasi modul", "Cara AI menentukan modul tiket dan ambang keyakinannya.", ModuleDrawer),
  priority: automation("🚦", "Nilai prioritas", "AI menilai ulang urgensi tiket dari isi pesan.", PriorityDrawer),
  guard: automation("🛡️", "Penjaga topik", "Saring tiket yang jelas di luar topik SIMRS.", GuardDrawer),
  kb: automation("🔎", "Cari panduan", "Cakupan pencarian artikel knowledge base.", KbDrawer),
  procedure: {
    kind: "embed",
    icon: "🧭",
    title: "Jalankan prosedur",
    description: "Ambang keyakinan dan langkah-langkah prosedur yang diikuti agen.",
    render: ({ config, data }) => (
      <ProcedureEmbed
        procedures={data.procedures}
        sources={data.sources}
        proceduresEnabled={config.proceduresEnabled}
        procedureConfidenceThreshold={config.procedureConfidenceThreshold}
      />
    ),
  },
  gate: automation(
    "🚪",
    "Gerbang auto-reply",
    "Syarat dan jadwal sebelum balasan otomatis dikirim.",
    GateDrawer,
    "Periksa jendela jadwal — jam mulai harus sebelum jam selesai.",
  ),
  reply: {
    kind: "embed",
    icon: "✍️",
    title: "Perilaku & balasan",
    description: "Nama, persona, nada, bahasa, dan tanda tangan agen.",
    render: ({ config: c }) => (
      <AgentBehaviorForm
        config={{
          agentName: c.agentName,
          persona: c.persona,
          tone: c.tone,
          language: c.language,
          replySignature: c.replySignature,
          guardrails: c.guardrails,
        }}
      />
    ),
  },
  tools: {
    kind: "embed",
    icon: "⚙️",
    title: "Tools",
    description: "Alat eksternal yang dapat dipanggil agen, beserta kredensialnya.",
    render: ({ data }) => <AgentToolsClient tools={data.tools} credentials={data.credentials} />,
  },
};

export function isEditableNode(id: string): id is PipelineNodeId {
  return id in NODE_EDITORS && NODE_EDITORS[id as PipelineNodeId] != null;
}

/**
 * Hosts the active node's editor in the right drawer kind: form editors get the
 * Save footer + `register` bridge; embed editors render footerless from props.
 */
export function NodeDrawer({
  nodeId,
  config,
  embedData,
  onClose,
}: {
  nodeId: PipelineNodeId | null;
  config: AiConfig;
  embedData: CanvasEmbedData;
  onClose: () => void;
}) {
  const getUpdate = useRef<() => AiConfigUpdate>(() => ({}));
  const invalid = useRef(false);

  const register = useCallback<RegisterFn>((fn, isInvalid) => {
    getUpdate.current = fn;
    invalid.current = isInvalid;
  }, []);

  const def = nodeId ? NODE_EDITORS[nodeId] : undefined;
  const onOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  if (def?.kind === "embed") {
    return (
      <DrawerFrame
        open
        onOpenChange={onOpenChange}
        icon={def.icon}
        title={def.title}
        description={def.description}
        width="sm:max-w-2xl"
      >
        {def.render({ config, data: embedData })}
      </DrawerFrame>
    );
  }

  return (
    <FormDrawer
      open={def != null}
      onOpenChange={onOpenChange}
      icon={def?.icon ?? ""}
      title={def?.title ?? ""}
      description={def?.description ?? ""}
      onSave={async () => {
        if (def?.kind !== "form") return;
        if (invalid.current) throw new Error(def.invalidMessage ?? "Periksa isian.");
        await def.persist(getUpdate.current());
      }}
    >
      {def?.kind === "form" ? <def.Body config={config} register={register} /> : null}
    </FormDrawer>
  );
}
