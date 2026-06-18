"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/auth";
import {
  getAiConfig,
  updateAiConfig,
  type AiConfigUpdate,
} from "@/services/ai-config.service";
import {
  listTools,
  createTool,
  updateTool,
  deleteTool,
  testTool,
  listCredentials,
  createCredential,
  deleteCredential,
} from "@/services/agent-tools.service";
import {
  listProcedures,
  getProcedure,
  createProcedure,
  updateProcedure,
  deleteProcedure,
  type ProcedureInput,
} from "@/services/agent-procedures.service";
import { getMentionSources } from "@/services/agent-mention-sources.service";

/**
 * These actions write tool credentials and agent behavior, so they require an
 * admin/owner session. (knowledge.actions.ts only checks "is logged in" — admin
 * enforcement there lives in middleware; here we check the role explicitly.)
 */
async function requireAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || !["owner", "admin"].includes(role ?? "")) {
    throw new Error("Unauthorized");
  }
  return session;
}

function revalidateAgent() {
  revalidatePath("/app/agent");
  revalidatePath("/app/agent/automation");
  revalidatePath("/app/agent/tools");
  revalidatePath("/app/agent/procedures");
}

// ---- Behavior + Automation (both write the ai_configs singleton) ------------

const BEHAVIOR_FIELDS = [
  "agentName",
  "persona",
  "tone",
  "language",
  "replySignature",
  "guardrails",
] as const;

export async function updateAgentBehaviorAction(data: Pick<AiConfigUpdate, (typeof BEHAVIOR_FIELDS)[number]>) {
  await requireAdminSession();
  const update: AiConfigUpdate = {};
  for (const key of BEHAVIOR_FIELDS) {
    if (data[key] !== undefined) update[key] = data[key];
  }
  const config = await updateAiConfig(update);
  revalidateAgent();
  return config;
}

export async function updateAgentAutomationAction(data: AiConfigUpdate) {
  await requireAdminSession();
  // Behavior fields are owned by the Behavior page; strip them so the two pages
  // don't clobber each other.
  const update: AiConfigUpdate = { ...data };
  for (const key of BEHAVIOR_FIELDS) delete update[key];
  const config = await updateAiConfig(update);
  revalidateAgent();
  return config;
}

export async function getAgentConfigAction() {
  await requireAdminSession();
  return getAiConfig();
}

// ---- Tools ------------------------------------------------------------------

export async function listToolsAction() {
  await requireAdminSession();
  return listTools();
}

export async function createToolAction(data: {
  name: string;
  description: string;
  type: string;
  config: unknown;
  credentialId?: string | null;
  enabled?: boolean;
}) {
  await requireAdminSession();
  const tool = await createTool(data);
  revalidateAgent();
  return tool;
}

export async function updateToolAction(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    type: string;
    config: unknown;
    credentialId: string | null;
    enabled: boolean;
  }>
) {
  await requireAdminSession();
  const tool = await updateTool(id, data);
  revalidateAgent();
  return tool;
}

export async function deleteToolAction(id: string) {
  await requireAdminSession();
  await deleteTool(id);
  revalidateAgent();
}

export async function testToolAction(id: string, args: Record<string, unknown>) {
  await requireAdminSession();
  return testTool(id, args);
}

// ---- Credentials (plaintext never returned) ---------------------------------

export async function listCredentialsAction() {
  await requireAdminSession();
  return listCredentials();
}

export async function createCredentialAction(data: { name: string; kind: string; secret: string }) {
  await requireAdminSession();
  const cred = await createCredential(data);
  revalidateAgent();
  return cred;
}

export async function deleteCredentialAction(id: string) {
  await requireAdminSession();
  await deleteCredential(id);
  revalidateAgent();
}

// ---- Procedures ------------------------------------------------------------

export async function listProceduresAction() {
  await requireAdminSession();
  return listProcedures();
}

export async function getProcedureAction(id: string) {
  await requireAdminSession();
  return getProcedure(id);
}

export async function createProcedureAction(data: ProcedureInput) {
  await requireAdminSession();
  const row = await createProcedure(data);
  revalidateAgent();
  return row;
}

export async function updateProcedureAction(id: string, data: Partial<ProcedureInput>) {
  await requireAdminSession();
  const row = await updateProcedure(id, data);
  revalidateAgent();
  return row;
}

export async function deleteProcedureAction(id: string) {
  await requireAdminSession();
  await deleteProcedure(id);
  revalidateAgent();
}

// Mention sources for the `/` menu. KB bodies are never surfaced (id/title only).
export async function getMentionSourcesAction() {
  await requireAdminSession();
  return getMentionSources();
}
