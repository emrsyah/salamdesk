"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { RiArrowRightLine } from "@remixicon/react";
import { NODE_DEFS, EDGE_DEFS, type PipelineNodeId } from "@/lib/agent/pipeline-topology";
import type { AiConfig } from "@/services/ai-config.service";
import { cn } from "@/lib/utils";
import { ConfigNode, type ConfigNodeData } from "./config-node";
import { nodeConfigSummary } from "./node-summary";
import { MasterToolbar } from "./master-toolbar";
import { NodeDrawer, isEditableNode } from "./node-drawers";
import type { CanvasEmbedData } from "./canvas-data";

const NODE_TYPES = { config: ConfigNode };

/** Optional nodes that a config flag can switch off — render faint when off. */
function isDimmed(id: string, c: AiConfig): boolean {
  if (id === "procedure") return !c.proceduresEnabled;
  return false;
}

/**
 * The Agent Canvas (Phase 1): a static, read-only view of the locked triage
 * topology with each stage's current settings shown as badges. Editing arrives
 * in Phase 2. Desktop-first — on small screens we point users to the form tabs.
 */
export function AgentCanvas({
  config,
  embedData,
}: {
  config: AiConfig;
  embedData: CanvasEmbedData;
}) {
  const triageOff = !config.aiTriageEnabled;
  const [openNode, setOpenNode] = useState<PipelineNodeId | null>(null);

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    if (isEditableNode(node.id)) setOpenNode(node.id);
  }, []);

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = NODE_DEFS.map((def) => ({
      id: def.id,
      type: "config",
      position: { x: def.x, y: def.y },
      data: {
        icon: def.icon,
        label: def.label,
        badges: nodeConfigSummary(def.id, config),
        optional: def.optional ?? false,
        dimmed: isDimmed(def.id, config),
        editable: isEditableNode(def.id),
        selected: openNode === def.id,
      } satisfies ConfigNodeData,
      draggable: false,
      selectable: false,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }));

    const edges: Edge[] = EDGE_DEFS.map(({ from, to, optional }) => ({
      id: `${from}-${to}`,
      source: from,
      target: to,
      type: "smoothstep",
      style: {
        stroke: "#d4d4d8",
        strokeWidth: 1.6,
        opacity: optional ? 0.4 : 0.8,
        strokeDasharray: optional ? "4 4" : undefined,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#d4d4d8", width: 14, height: 14 },
    }));

    return { nodes, edges };
  }, [config, openNode]);

  return (
    <div className="space-y-4">
      <MasterToolbar config={config} />

      {/* Mobile fallback — the canvas is desktop-first. */}
      <div className="rounded-xl border bg-muted/20 p-6 text-center md:hidden">
        <p className="text-sm font-medium">Kanvas paling baik dilihat di layar lebar.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Gunakan tab di bawah untuk mengatur agen dari perangkat ini.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {[
            { href: "/app/agent/automation", label: "Otomasi & Jadwal" },
            { href: "/app/agent", label: "Perilaku" },
          ].map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted"
            >
              {t.label}
              <RiArrowRightLine className="size-3.5" />
            </Link>
          ))}
        </div>
      </div>

      {/* Canvas — desktop only. */}
      <p className="hidden text-xs text-muted-foreground md:block">
        Klik tahap mana pun untuk mengatur perilakunya. Tahap bergaris putus-putus bersifat opsional.
      </p>
      <div
        className={cn(
          "hidden h-[calc(100vh-280px)] min-h-[480px] overflow-hidden rounded-xl border bg-background md:block",
          triageOff && "opacity-60",
        )}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.08 }}
          minZoom={0.2}
          maxZoom={1.6}
          onNodeClick={onNodeClick}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          panOnDrag
          panOnScroll={false}
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick
          proOptions={{ hideAttribution: true }}
          className="!bg-transparent"
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#e4e4e7" />
          <Controls showInteractive={false} className="!shadow-md" position="bottom-right" />
        </ReactFlow>
      </div>

      <NodeDrawer
        nodeId={openNode}
        config={config}
        embedData={embedData}
        onClose={() => setOpenNode(null)}
      />
    </div>
  );
}
