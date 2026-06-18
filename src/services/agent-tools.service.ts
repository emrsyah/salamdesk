import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentTools, agentCredentials } from "@/db/schema/agent";
import { encryptSecret, getSecretKey } from "@/lib/crypto/secret-box";
import {
  httpToolConfigSchema,
  exaToolConfigSchema,
} from "./agent-tools.types";
import { executeHttpTool } from "./agent-tool-executor.service";
import { exaSearch } from "./exa.service";

export type AgentToolRow = typeof agentTools.$inferSelect;

/** Validate a tool's config against the schema for its type. Throws on mismatch. */
function validateConfig(type: string, config: unknown): unknown {
  if (type === "http") return httpToolConfigSchema.parse(config);
  if (type === "exa_search") return exaToolConfigSchema.parse(config);
  throw new Error(`Unknown tool type: ${type}`);
}

// ---- Tools -----------------------------------------------------------------

export async function listTools(): Promise<AgentToolRow[]> {
  return db.select().from(agentTools).orderBy(agentTools.createdAt).execute();
}

export async function getTool(id: string): Promise<AgentToolRow | null> {
  const [row] = await db.select().from(agentTools).where(eq(agentTools.id, id));
  return row ?? null;
}

export async function createTool(data: {
  name: string;
  description: string;
  type: string;
  config: unknown;
  credentialId?: string | null;
  enabled?: boolean;
}): Promise<AgentToolRow> {
  const config = validateConfig(data.type, data.config);
  const [row] = await db
    .insert(agentTools)
    .values({
      name: data.name,
      description: data.description,
      type: data.type,
      config,
      credentialId: data.credentialId ?? null,
      enabled: data.enabled ?? true,
    })
    .returning();
  return row;
}

export async function updateTool(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    type: string;
    config: unknown;
    credentialId: string | null;
    enabled: boolean;
  }>
): Promise<AgentToolRow> {
  const patch: Partial<typeof agentTools.$inferInsert> = { updatedAt: new Date() };
  if (data.name !== undefined) patch.name = data.name;
  if (data.description !== undefined) patch.description = data.description;
  if (data.type !== undefined) patch.type = data.type;
  if (data.enabled !== undefined) patch.enabled = data.enabled;
  if (data.credentialId !== undefined) patch.credentialId = data.credentialId;
  if (data.config !== undefined) {
    const type = data.type ?? (await getTool(id))?.type;
    if (!type) throw new Error(`Tool ${id} not found.`);
    patch.config = validateConfig(type, data.config);
  }
  const [row] = await db.update(agentTools).set(patch).where(eq(agentTools.id, id)).returning();
  return row;
}

export async function deleteTool(id: string): Promise<void> {
  await db.delete(agentTools).where(eq(agentTools.id, id)).execute();
}

// ---- Credentials (secrets never leave the server in plaintext) -------------

export type CredentialSummary = { id: string; name: string; kind: string };

export async function listCredentials(): Promise<CredentialSummary[]> {
  const rows = await db
    .select({ id: agentCredentials.id, name: agentCredentials.name, kind: agentCredentials.kind })
    .from(agentCredentials)
    .orderBy(agentCredentials.createdAt)
    .execute();
  return rows;
}

export async function createCredential(data: {
  name: string;
  kind: string;
  secret: string;
}): Promise<CredentialSummary> {
  const secretEncrypted = encryptSecret(data.secret, getSecretKey());
  const [row] = await db
    .insert(agentCredentials)
    .values({ name: data.name, kind: data.kind, secretEncrypted })
    .returning({ id: agentCredentials.id, name: agentCredentials.name, kind: agentCredentials.kind });
  return row;
}

export async function deleteCredential(id: string): Promise<void> {
  await db.delete(agentCredentials).where(eq(agentCredentials.id, id)).execute();
}

// ---- Test runner (for the Tools page "Test" button) ------------------------

export async function testTool(
  id: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const row = await getTool(id);
  if (!row) throw new Error(`Tool ${id} not found.`);
  if (row.type === "http") {
    return executeHttpTool(httpToolConfigSchema.parse(row.config), row.credentialId, args);
  }
  if (row.type === "exa_search") {
    const cfg = exaToolConfigSchema.parse(row.config);
    const query = typeof args.query === "string" ? args.query : "";
    return { results: await exaSearch(query, cfg.numResults) };
  }
  throw new Error(`Unknown tool type: ${row.type}`);
}
