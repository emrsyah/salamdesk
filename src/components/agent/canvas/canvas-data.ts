import type { ProcedureContent } from "@/lib/agent/procedure-content";
import type { MentionSource } from "@/services/agent-mention-sources.service";

/**
 * Data the embed-kind node drawers (tools, procedures) need beyond the AI
 * config. Fetched on the server canvas page and threaded down as props so the
 * reused self-saving editors keep their `router.refresh()`-reads-server-props
 * loop intact — a new tool/procedure shows up without reopening the drawer.
 */
export interface CanvasToolItem {
  id: string;
  name: string;
  description: string;
  type: string;
  config: unknown;
  credentialId: string | null;
  enabled: boolean;
}

export interface CanvasCredential {
  id: string;
  name: string;
  kind: string;
}

export interface CanvasProcedure {
  id: string;
  title: string;
  whenToUse: string;
  content: ProcedureContent;
  enabled: boolean;
  order: number;
}

export interface CanvasEmbedData {
  tools: CanvasToolItem[];
  credentials: CanvasCredential[];
  procedures: CanvasProcedure[];
  sources: MentionSource[];
}
