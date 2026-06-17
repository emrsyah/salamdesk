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

/** Parse an IPv4 host in any encoding (dotted decimal/octal/hex, or a single
 * integer) into 4 octets, or null if it isn't an IPv4 literal. */
function parseIpv4(host: string): number[] | null {
  const toNum = (s: string): number | null => {
    if (s === "") return null;
    let n: number;
    if (/^0x[0-9a-f]+$/i.test(s)) n = parseInt(s, 16);
    else if (/^0[0-7]+$/.test(s)) n = parseInt(s, 8);
    else if (/^\d+$/.test(s)) n = parseInt(s, 10);
    else return null;
    return Number.isFinite(n) ? n : null;
  };
  const parts = host.split(".");
  if (parts.length === 1) {
    const n = toNum(parts[0]);
    if (n === null || n < 0 || n > 0xffffffff) return null;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  }
  if (parts.length === 4) {
    const nums = parts.map(toNum);
    if (nums.some((x) => x === null || x < 0 || x > 255)) return null;
    return nums as number[];
  }
  return null;
}

function isBlockedIpv4(octets: number[]): boolean {
  const [a, b] = octets;
  return (
    a === 0 || // 0.0.0.0/8 "this network"
    a === 127 || // loopback 127/8
    a === 10 || // private
    (a === 169 && b === 254) || // link-local (cloud metadata)
    (a === 192 && b === 168) || // private
    (a === 172 && b >= 16 && b <= 31) // private
  );
}

/**
 * Guard tool target hosts against SSRF. Denylist-by-normalization: we reject
 * loopback/private/link-local in any IP encoding plus internal IPv6 ranges.
 * Note: the executor also disables redirects, since a public host can 30x to an
 * internal one carrying the credential header.
 */
export function isHostAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    // hostname keeps brackets for IPv6 literals ("[::1]") — strip them.
    const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".localhost")) return false;

    if (host.includes(":")) {
      // IPv6 literal
      if (host === "::1") return false; // loopback
      if (host.startsWith("fc") || host.startsWith("fd")) return false; // ULA fc00::/7
      if (/^fe[89ab]/.test(host)) return false; // link-local fe80::/10
      if (host.startsWith("::ffff:")) {
        const rest = host.slice(7);
        // Node compresses ::ffff:169.254.169.254 to hex (::ffff:a9fe:a9fe).
        let mapped = parseIpv4(rest);
        if (!mapped && /^[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(rest)) {
          const [hi, lo] = rest.split(":").map((h) => parseInt(h, 16));
          mapped = [(hi >> 8) & 255, hi & 255, (lo >> 8) & 255, lo & 255];
        }
        if (mapped && isBlockedIpv4(mapped)) return false;
      }
      return true;
    }

    const octets = parseIpv4(host);
    if (octets && isBlockedIpv4(octets)) return false;
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
    // Encode path values so a value can't rewrite the host/path
    // (e.g. id = "@evil.com/" or "../admin").
    if (p.in === "path") pathVars[p.name] = encodeURIComponent(String(args[p.name] ?? ""));
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
    // Do NOT follow redirects: a public host could 30x to an internal address
    // (e.g. cloud metadata) and fetch would carry the credential header along.
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status >= 300 && res.status < 400) {
    return { ok: false, status: res.status, error: "Redirects are not allowed for tool calls." };
  }
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
