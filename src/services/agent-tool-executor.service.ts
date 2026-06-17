import { tool, jsonSchema, type ToolSet } from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentTools, agentCredentials } from "@/db/schema/agent";
import { decryptSecret, getSecretKey } from "@/lib/crypto/secret-box";
import { httpToolConfigSchema, exaToolConfigSchema, type HttpToolConfig } from "./agent-tools.types";
import { exaSearch } from "./exa.service";

export function interpolate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? "" : String(vars[k])));
}

export function extractJsonPath(value: unknown, path: string): unknown {
  if (!path) return value;
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) => (acc == null ? acc : (acc as Record<string, unknown>)[key]),
      value
    );
}

const BLOCKED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254", "::1"];

export function isHostAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (BLOCKED_HOSTS.includes(u.hostname)) return false;
    if (/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Build a JSON Schema for the model from user-defined params. We use the SDK's
 * `jsonSchema()` (not a dynamic `z.object`) because a dynamically-shaped Zod
 * object defeats the SDK's `tool()` type inference.
 */
function paramsToInputSchema(cfg: HttpToolConfig) {
  const properties: Record<
    string,
    { type: "string" | "number" | "boolean"; description?: string }
  > = {};
  const required: string[] = [];
  for (const p of cfg.params) {
    properties[p.name] = p.description
      ? { type: p.type, description: p.description }
      : { type: p.type };
    if (p.required) required.push(p.name);
  }
  return jsonSchema<Record<string, unknown>>({
    type: "object",
    properties,
    required,
    additionalProperties: false,
  });
}

async function credentialHeader(credentialId: string | null): Promise<Record<string, string>> {
  if (!credentialId) return {};
  const [cred] = await db.select().from(agentCredentials).where(eq(agentCredentials.id, credentialId));
  if (!cred) return {};
  const secret = decryptSecret(cred.secretEncrypted, getSecretKey());
  if (cred.kind === "bearer") return { Authorization: `Bearer ${secret}` };
  if (cred.kind === "basic") return { Authorization: `Basic ${Buffer.from(secret).toString("base64")}` };
  if (cred.kind === "api_key_header") {
    // Stored as "Header-Name:value". Split on the FIRST colon only — the value
    // may itself contain ':' (URLs, base64 padding).
    const i = secret.indexOf(":");
    if (i < 0) return {};
    const name = secret.slice(0, i);
    const val = secret.slice(i + 1);
    return name && val ? { [name]: val } : {};
  }
  return {};
}

export async function executeHttpTool(
  cfg: HttpToolConfig,
  credentialId: string | null,
  args: Record<string, unknown>
) {
  const pathVars: Record<string, unknown> = {};
  const query = new URLSearchParams();
  for (const p of cfg.params) {
    if (p.in === "path") pathVars[p.name] = args[p.name];
    if (p.in === "query" && args[p.name] != null) query.set(p.name, String(args[p.name]));
  }
  let url = interpolate(cfg.urlTemplate, pathVars);
  if ([...query].length) url += (url.includes("?") ? "&" : "?") + query.toString();
  if (!isHostAllowed(url)) throw new Error("Tool target host is not allowed.");

  const headers: Record<string, string> = { ...cfg.headers, ...(await credentialHeader(credentialId)) };
  const hasBody = cfg.method !== "GET" && cfg.method !== "DELETE";
  const body = hasBody && cfg.bodyTemplate ? interpolate(cfg.bodyTemplate, args) : undefined;
  if (body) headers["Content-Type"] = headers["Content-Type"] ?? "application/json";

  const res = await fetch(url, {
    method: cfg.method,
    headers,
    body,
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* leave as text */
  }
  if (!res.ok) return { ok: false, status: res.status, error: parsed };
  return { ok: true, status: res.status, data: extractJsonPath(parsed, cfg.responseJsonPath) };
}

/** Build AI SDK tools from enabled rows. Tools whose secrets can't load are skipped. */
export async function buildAgentTools() {
  let secretsOk = true;
  try {
    getSecretKey();
  } catch {
    secretsOk = false;
  }

  const rows = await db.select().from(agentTools).where(eq(agentTools.enabled, true));
  const tools: ToolSet = {};

  for (const row of rows) {
    if (row.type === "exa_search") {
      const cfg = exaToolConfigSchema.parse(row.config);
      tools[row.name] = tool({
        description: row.description,
        inputSchema: z.object({ query: z.string().describe("Search query") }),
        execute: async ({ query }) => ({ results: await exaSearch(query, cfg.numResults) }),
      });
    } else if (row.type === "http") {
      if (!secretsOk && row.credentialId) continue; // can't decrypt → skip
      const cfg = httpToolConfigSchema.parse(row.config);
      tools[row.name] = tool({
        description: row.description,
        inputSchema: paramsToInputSchema(cfg),
        execute: async (args) => executeHttpTool(cfg, row.credentialId, args),
      });
    }
  }
  return tools;
}
