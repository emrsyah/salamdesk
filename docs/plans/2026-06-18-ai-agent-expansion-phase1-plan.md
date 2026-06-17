# AI Agent Expansion — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use subagent-driven-development (if subagents available) or executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the AI agent config from a settings modal into a dedicated "AI Agent" section, add agent Behavior/voice, a Tools/integrations system (custom HTTP + Exa) with encrypted credentials, and schedule-aware auto-reply — all on the existing single-agent (`ai_configs`) model.

**Architecture:** Extend the `ai_configs` singleton with Behavior + business-hours columns. Add `agent_tools` + `agent_credentials` tables with a tool-executor service (AI SDK tools built dynamically) and app-level secret encryption. Replace the "Perilaku AI" settings tab with real routes under `/app/agent`. Wire Exa search into the copilot panel as a proof-of-use.

**Tech Stack:** Next.js 16 (App Router, server actions), Drizzle ORM + Postgres, `ai` SDK v6 (`generateObject`/`generateText`/`tool`) via OpenRouter, Zod v4, bun:test, Node `crypto` (AES-256-GCM).

**Design doc:** `docs/plans/2026-06-18-ai-agent-expansion-design.md`

---

## Conventions (read first)

- **Migrations are hand-written.** Add a numbered SQL file in `src/db/migrations/` AND a matching entry in `src/db/migrations/meta/_journal.json` (next `idx`, `version: "7"`, a `when` larger than the previous, the file's `tag`). The latest is `0011_knowledge_multi_module`.
- **Tests:** `bun:test`, colocated `*.test.ts`. Prefer pure functions. Run a single file with `bun test src/path/x.test.ts`.
- **Typecheck:** `npm run typecheck`. **Lint:** `npx eslint <files>`.
- **AI calls:** import `getAiModel` from `@/lib/ai`, use `generateObject`/`generateText`/`tool` from `ai`.
- **Admin guard:** add `/app/agent` to `adminRoutes` in `src/middleware.ts:30`.
- **Schema barrel:** every new schema file must be re-exported from `src/db/schema/index.ts`.
- Convert any relative dates to absolute. Today is 2026-06-18.

---

## File structure (Phase 1)

Created:
- `src/db/migrations/0012_agent_behavior_schedule.sql` — `ai_configs` new columns
- `src/db/migrations/0013_agent_tools.sql` — `agent_credentials`, `agent_tools`
- `src/db/schema/agent.ts` — `agentTools`, `agentCredentials` tables
- `src/lib/crypto/secret-box.ts` (+ `.test.ts`) — AES-256-GCM encrypt/decrypt
- `src/lib/agent/business-hours.ts` (+ `.test.ts`) — schedule window evaluation
- `src/services/agent-tools.service.ts` — CRUD for tools + credentials
- `src/services/agent-tool-executor.service.ts` (+ `.test.ts`) — build AI SDK tools, run HTTP/Exa
- `src/services/exa.service.ts` — Exa search client
- `src/actions/agent.actions.ts` — server actions for Behavior/Automation/Tools pages
- `src/app/app/agent/layout.tsx` — section shell + sub-nav
- `src/app/app/agent/page.tsx` — Behavior
- `src/app/app/agent/automation/page.tsx` — gates + schedule
- `src/app/app/agent/tools/page.tsx` — tools list
- `src/components/agent/*` — client forms (behavior, automation, tool editor, tool test runner)

Modified:
- `src/db/schema/ai-config.ts` — add Behavior + `businessHours` columns
- `src/services/ai-config.service.ts` — extend `AiConfig`, defaults, mappers, update
- `src/services/auto-reply-policy.service.ts` — schedule-aware gate
- `src/db/schema/index.ts` — export `agent`
- `src/middleware.ts:30` — guard `/app/agent`
- `src/components/helpdesk-sidebar.tsx` — add "AI Agent" nav item; remove AI tab usage if desired
- `src/components/settings-dialog.tsx` — remove "Perilaku AI" tab (migrated)
- `src/actions/ai-copilot.actions.ts` + `src/components/tickets/ticket-ai-copilot-panel.tsx` — Exa web search action + UI

---

## Chunk 1: Secret encryption + schedule core (pure, TDD)

### Task 1: AES-256-GCM secret box

**Files:**
- Create: `src/lib/crypto/secret-box.ts`
- Test: `src/lib/crypto/secret-box.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { encryptSecret, decryptSecret } from "./secret-box";

const KEY = "0".repeat(64); // 32 bytes hex

describe("secret-box", () => {
  test("round-trips a secret", () => {
    const enc = encryptSecret("super-secret-token", KEY);
    expect(enc).not.toContain("super-secret-token");
    expect(decryptSecret(enc, KEY)).toBe("super-secret-token");
  });

  test("ciphertext is non-deterministic (random IV)", () => {
    expect(encryptSecret("x", KEY)).not.toBe(encryptSecret("x", KEY));
  });

  test("tampered ciphertext throws", () => {
    const enc = encryptSecret("x", KEY);
    const bad = enc.slice(0, -2) + (enc.endsWith("aa") ? "bb" : "aa");
    expect(() => decryptSecret(bad, KEY)).toThrow();
  });
});
```

- [ ] **Step 2: Run it, confirm it fails** — `bun test src/lib/crypto/secret-box.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Format: base64(iv).base64(authTag).base64(ciphertext)
const ALGO = "aes-256-gcm";

function keyBuffer(hexKey: string): Buffer {
  const key = Buffer.from(hexKey, "hex");
  if (key.length !== 32) {
    throw new Error("AGENT_SECRET_KEY must be 32 bytes (64 hex chars).");
  }
  return key;
}

export function encryptSecret(plaintext: string, hexKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, keyBuffer(hexKey), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${ct.toString("base64")}`;
}

export function decryptSecret(payload: string, hexKey: string): string {
  const [ivB64, tagB64, ctB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("Malformed secret payload.");
  const decipher = createDecipheriv(ALGO, keyBuffer(hexKey), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}

/** Reads AGENT_SECRET_KEY from env; throws if absent so callers can disable tools. */
export function getSecretKey(): string {
  const key = process.env.AGENT_SECRET_KEY;
  if (!key) throw new Error("AGENT_SECRET_KEY is not set.");
  return key;
}
```

- [ ] **Step 4: Run tests → PASS.**
- [ ] **Step 5: Commit** — `feat(agent): AES-256-GCM secret box for tool credentials`.
- [ ] **Step 6:** Add `AGENT_SECRET_KEY` to `.env.example` with a note: `# 64 hex chars; generate: openssl rand -hex 32`.

### Task 2: Business-hours evaluation

**Files:**
- Create: `src/lib/agent/business-hours.ts`
- Test: `src/lib/agent/business-hours.test.ts`

Schedule shape (stored in `ai_configs.business_hours` jsonb):

```ts
export type ReplyMode = "auto" | "draft-only";
export type BusinessHours = {
  enabled: boolean;
  timezone: string;            // IANA, e.g. "Asia/Jakarta"
  defaultMode: ReplyMode;      // mode outside all windows
  windows: { days: number[]; start: string; end: string; mode: ReplyMode }[]; // days 0-6 (Sun=0), "HH:mm"
};
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { resolveReplyMode, type BusinessHours } from "./business-hours";

const hours: BusinessHours = {
  enabled: true,
  timezone: "Asia/Jakarta",
  defaultMode: "auto",                 // after hours → autopilot
  windows: [{ days: [1, 2, 3, 4, 5], start: "08:00", end: "17:00", mode: "draft-only" }],
};

describe("resolveReplyMode", () => {
  test("inside a window uses the window mode", () => {
    // Wed 2026-06-17 10:00 Asia/Jakarta == 03:00Z
    expect(resolveReplyMode(hours, new Date("2026-06-17T03:00:00Z"))).toBe("draft-only");
  });
  test("outside windows uses defaultMode", () => {
    // Wed 2026-06-17 22:00 Asia/Jakarta == 15:00Z
    expect(resolveReplyMode(hours, new Date("2026-06-17T15:00:00Z"))).toBe("auto");
  });
  test("disabled schedule always returns auto", () => {
    expect(resolveReplyMode({ ...hours, enabled: false }, new Date("2026-06-17T03:00:00Z"))).toBe("auto");
  });
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** (use `Intl.DateTimeFormat` with the timezone to get local weekday + HH:mm; no external tz lib).

```ts
export type ReplyMode = "auto" | "draft-only";
export type BusinessHours = {
  enabled: boolean;
  timezone: string;
  defaultMode: ReplyMode;
  windows: { days: number[]; start: string; end: string; mode: ReplyMode }[];
};

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  enabled: false,
  timezone: "Asia/Jakarta",
  defaultMode: "auto",
  windows: [],
};

function localParts(tz: string, when: Date): { day: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(when).map((p) => [p.type, p.value]));
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  return { day: dayMap[parts.weekday as string] ?? 0, minutes: hour * 60 + Number(parts.minute) };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Which reply mode applies at `when`. Disabled → always "auto" (no restriction). */
export function resolveReplyMode(hours: BusinessHours, when: Date): ReplyMode {
  if (!hours.enabled) return "auto";
  const { day, minutes } = localParts(hours.timezone, when);
  for (const w of hours.windows) {
    if (w.days.includes(day) && minutes >= toMinutes(w.start) && minutes < toMinutes(w.end)) {
      return w.mode;
    }
  }
  return hours.defaultMode;
}
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(agent): business-hours reply-mode evaluation`.

> Reviewer note: if the cross-midnight window case matters, add a test + handling (`start > end`). YAGNI for now unless the user needs night windows.

---

## Chunk 2: Schema + config extension

### Task 3: Extend `ai_configs` (Behavior + schedule)

**Files:**
- Modify: `src/db/schema/ai-config.ts`
- Create: `src/db/migrations/0012_agent_behavior_schedule.sql`
- Modify: `src/db/migrations/meta/_journal.json`

- [ ] **Step 1:** Add columns to `aiConfigs` (after `maxAutoRepliesPerTicket`):

```ts
  // ---- Behavior / voice --------------------------------------------------
  agentName: text("agent_name").notNull().default("Asisten"),
  persona: text("persona").notNull().default(""),
  tone: text("tone").notNull().default(""),
  language: text("language").notNull().default("id"),
  replySignature: text("reply_signature").notNull().default(""),
  guardrails: text("guardrails").notNull().default(""),
  // ---- Schedule ----------------------------------------------------------
  businessHours: jsonb("business_hours"), // BusinessHours | null
```

Add `jsonb` to the drizzle import.

- [ ] **Step 2:** Write `0012_agent_behavior_schedule.sql`:

```sql
ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "agent_name" text DEFAULT 'Asisten' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "persona" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "tone" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "language" text DEFAULT 'id' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "reply_signature" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "guardrails" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "business_hours" jsonb;
```

- [ ] **Step 3:** Append journal entry `idx: 12`, `tag: "0012_agent_behavior_schedule"`, `when` > previous.
- [ ] **Step 4:** `npm run typecheck` → PASS. **Commit** — `feat(agent): ai_configs behavior + business_hours columns`.

### Task 4: Extend `ai-config.service.ts`

**Files:** Modify `src/services/ai-config.service.ts`

- [ ] **Step 1:** Extend the `AiConfig` type, `DEFAULT_AI_CONFIG`, and `rowToConfig` with the six behavior fields (string) and `businessHours: BusinessHours` (import `BusinessHours`, `DEFAULT_BUSINESS_HOURS` from `@/lib/agent/business-hours`). In `rowToConfig`, `businessHours: (row.businessHours as BusinessHours) ?? DEFAULT_BUSINESS_HOURS`.
- [ ] **Step 2:** In `updateAiConfig`, add pass-through for each behavior field (trim strings) and `if (update.businessHours !== undefined) patch.businessHours = update.businessHours;`.
- [ ] **Step 3:** `npm run typecheck` → PASS. **Commit** — `feat(agent): behavior + schedule in ai-config service`.

### Task 5: `agent_tools` + `agent_credentials` schema

**Files:**
- Create: `src/db/schema/agent.ts`
- Modify: `src/db/schema/index.ts`
- Create: `src/db/migrations/0013_agent_tools.sql` + journal entry

- [ ] **Step 1:** `src/db/schema/agent.ts`:

```ts
import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const agentCredentials = pgTable("agent_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // bearer | api_key_header | basic | custom
  secretEncrypted: text("secret_encrypted").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentTools = pgTable("agent_tools", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull(), // what the LLM reads to decide to call it
  type: text("type").notNull(),              // http | exa_search
  config: jsonb("config").notNull(),
  credentialId: uuid("credential_id").references(() => agentCredentials.id, { onDelete: "set null" }),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("agent_tools_enabled_idx").on(t.enabled)]);

export const agentToolsRelations = relations(agentTools, ({ one }) => ({
  credential: one(agentCredentials, { fields: [agentTools.credentialId], references: [agentCredentials.id] }),
}));
```

- [ ] **Step 2:** Add `export * from "./agent";` to `src/db/schema/index.ts`.
- [ ] **Step 3:** `0013_agent_tools.sql`:

```sql
CREATE TABLE IF NOT EXISTS "agent_credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "kind" text NOT NULL,
  "secret_encrypted" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_tools" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "type" text NOT NULL,
  "config" jsonb NOT NULL,
  "credential_id" uuid,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "agent_tools" ADD CONSTRAINT "agent_tools_credential_id_fk"
    FOREIGN KEY ("credential_id") REFERENCES "agent_credentials"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_tools_enabled_idx" ON "agent_tools" ("enabled");
```

- [ ] **Step 4:** Journal entry `idx: 13`. `npm run typecheck` → PASS. **Commit** — `feat(agent): agent_tools + agent_credentials schema`.

---

## Chunk 3: Tool config types, executor, Exa

### Task 6: Tool config types + zod validation

**Files:** Create `src/services/agent-tools.types.ts`

- [ ] **Step 1:** Define discriminated config + input schemas. Keep input params as a simple JSON-schema-ish list the UI can edit and we can convert to zod:

```ts
import { z } from "zod";

export const httpParamSchema = z.object({
  name: z.string().min(1),
  in: z.enum(["query", "path", "body"]),
  type: z.enum(["string", "number", "boolean"]).default("string"),
  required: z.boolean().default(false),
  description: z.string().default(""),
});

export const httpToolConfigSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  // May contain {path} placeholders, so it is NOT a strict URL. The real guard
  // is `isHostAllowed` at execution time. (z.string().url() is deprecated in
  // zod v4 and would reject templates anyway.)
  urlTemplate: z.string().startsWith("http"),
  headers: z.record(z.string(), z.string()).default({}),
  params: z.array(httpParamSchema).default([]),
  bodyTemplate: z.string().default(""),  // optional JSON template with {placeholders}
  responseJsonPath: z.string().default(""), // optional dot-path to extract; "" = whole body
});

export const exaToolConfigSchema = z.object({
  numResults: z.number().int().min(1).max(10).default(5),
});

export type HttpToolConfig = z.infer<typeof httpToolConfigSchema>;
export type ExaToolConfig = z.infer<typeof exaToolConfigSchema>;
```

- [ ] **Step 2:** `npm run typecheck`. **Commit** — `feat(agent): tool config schemas`.

### Task 7: Exa search client

**Files:** Create `src/services/exa.service.ts`

- [ ] **Step 1:** Implement a thin fetch wrapper (Exa REST `POST https://api.exa.ai/search`). Key from `EXA_API_KEY` env (per design: first-party keys via env).

```ts
export type ExaResult = { title: string; url: string; text: string };

export async function exaSearch(query: string, numResults = 5): Promise<ExaResult[]> {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new Error("EXA_API_KEY is not set.");
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify({ query, numResults, contents: { text: { maxCharacters: 1000 } } }),
  });
  if (!res.ok) throw new Error(`Exa search failed: ${res.status}`);
  const data = (await res.json()) as { results?: { title?: string; url?: string; text?: string }[] };
  return (data.results ?? []).map((r) => ({ title: r.title ?? "", url: r.url ?? "", text: r.text ?? "" }));
}
```

- [ ] **Step 2:** Add `EXA_API_KEY` to `.env.example`. **Commit** — `feat(agent): Exa search client`.

### Task 8: Tool executor (HTTP interpolation) — TDD

**Files:**
- Create: `src/services/agent-tool-executor.service.ts`
- Test: `src/services/agent-tool-executor.service.test.ts`

Pull the pure pieces (URL/body interpolation, host allowlist, response extraction) out so they're unit-testable without network.

- [ ] **Step 1: Failing test** (pure helpers):

```ts
import { describe, expect, test } from "bun:test";
import { interpolate, extractJsonPath, isHostAllowed } from "./agent-tool-executor.service";

describe("tool executor helpers", () => {
  test("interpolate fills {placeholders}", () => {
    expect(interpolate("https://api/{id}/x", { id: "42" })).toBe("https://api/42/x");
  });
  test("interpolate leaves unknown placeholders empty", () => {
    expect(interpolate("a/{missing}", {})).toBe("a/");
  });
  test("extractJsonPath reads dot paths", () => {
    expect(extractJsonPath({ a: { b: 7 } }, "a.b")).toBe(7);
    expect(extractJsonPath({ a: 1 }, "")).toEqual({ a: 1 });
  });
  test("isHostAllowed enforces denylist of internal hosts", () => {
    expect(isHostAllowed("https://api.stripe.com/x")).toBe(true);
    expect(isHostAllowed("http://localhost:6767")).toBe(false);
    expect(isHostAllowed("http://169.254.169.254/latest")).toBe(false); // SSRF metadata
  });
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement helpers + executor.** Helpers are pure; `executeHttpTool` and `buildAgentTools` do IO.

```ts
import { tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { agentTools, agentCredentials } from "@/db/schema/agent";
import { eq } from "drizzle-orm";
import { decryptSecret, getSecretKey } from "@/lib/crypto/secret-box";
import { httpToolConfigSchema, exaToolConfigSchema, type HttpToolConfig } from "./agent-tools.types";
import { exaSearch } from "./exa.service";

export function interpolate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? "" : String(vars[k])));
}

export function extractJsonPath(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split(".").reduce<unknown>((acc, key) => (acc == null ? acc : (acc as Record<string, unknown>)[key]), value);
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

function paramsToZod(cfg: HttpToolConfig) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const p of cfg.params) {
    let s: z.ZodTypeAny = p.type === "number" ? z.number() : p.type === "boolean" ? z.boolean() : z.string();
    if (p.description) s = s.describe(p.description);
    shape[p.name] = p.required ? s : s.optional();
  }
  return z.object(shape);
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

export async function executeHttpTool(cfg: HttpToolConfig, credentialId: string | null, args: Record<string, unknown>) {
  const pathVars: Record<string, unknown> = {};
  const query = new URLSearchParams();
  for (const p of cfg.params) {
    if (p.in === "path") pathVars[p.name] = args[p.name];
    if (p.in === "query" && args[p.name] != null) query.set(p.name, String(args[p.name]));
  }
  let url = interpolate(cfg.urlTemplate, pathVars);
  if ([...query].length) url += (url.includes("?") ? "&" : "?") + query.toString();
  if (!isHostAllowed(url)) throw new Error("Tool target host is not allowed.");

  const headers = { ...cfg.headers, ...(await credentialHeader(credentialId)) };
  const hasBody = cfg.method !== "GET" && cfg.method !== "DELETE";
  const body = hasBody && cfg.bodyTemplate ? interpolate(cfg.bodyTemplate, args) : undefined;
  if (body) headers["Content-Type"] = headers["Content-Type"] ?? "application/json";

  const res = await fetch(url, { method: cfg.method, headers, body, signal: AbortSignal.timeout(10_000) });
  const text = await res.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch { /* leave as text */ }
  if (!res.ok) return { ok: false, status: res.status, error: parsed };
  return { ok: true, status: res.status, data: extractJsonPath(parsed, cfg.responseJsonPath) };
}

/** Build AI SDK tools from enabled rows. Tools whose secrets can't load are skipped. */
export async function buildAgentTools() {
  let secretsOk = true;
  try { getSecretKey(); } catch { secretsOk = false; }

  const rows = await db.select().from(agentTools).where(eq(agentTools.enabled, true));
  const tools: Record<string, ReturnType<typeof tool>> = {};

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
        inputSchema: paramsToZod(cfg),
        execute: async (args) => executeHttpTool(cfg, row.credentialId, args as Record<string, unknown>),
      });
    }
  }
  return tools;
}
```

- [ ] **Step 4: Run → PASS.** `npm run typecheck`.
- [ ] **Step 5: Commit** — `feat(agent): tool executor (http + exa) with SSRF guard`.

> Reviewer note: confirm the installed `ai` v6 `tool()` signature uses `inputSchema` (it does in v5+/v6). If the project is on an older shape, switch to `parameters`.

### Task 9: Tools + credentials CRUD service

**Files:** Create `src/services/agent-tools.service.ts`

- [ ] **Step 1:** Implement `listTools`, `getTool`, `createTool`, `updateTool`, `deleteTool` (validate `config` with the right zod schema by `type`), and credential CRUD that **encrypts on write** (`encryptSecret(secret, getSecretKey())`) and **never returns the plaintext** (return `{ id, name, kind }` only). Provide `testTool(id, args)` that calls `executeHttpTool`/`exaSearch` for the Tools page "Test" runner.
- [ ] **Step 2:** `npm run typecheck`. **Commit** — `feat(agent): tools + credentials CRUD service`.

---

## Chunk 4: Schedule-aware auto-reply

### Task 10: Make the auto-reply policy schedule-aware — TDD

**Files:**
- Modify: `src/services/auto-reply-policy.service.ts`
- Test: `src/services/auto-reply-policy.service.test.ts` (new)

Decision: keep `canAutoReply` returning `allowed/blockedReason`, but add an optional `now` + use `resolveReplyMode`. When schedule resolves to `draft-only`, block with a clear reason (the existing delay/draft path already drafts for humans).

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, test } from "bun:test";
import { canAutoReply } from "./auto-reply-policy.service";
import { DEFAULT_AI_CONFIG } from "./ai-config.service";

const base = {
  priority: "low" as const, suggestedReply: "hi", replyConfidence: 0.9,
  kbArticleId: "kb1", ticketText: "halo", source: "whatsapp", priorAutoReplies: 0,
};
const cfg = { ...DEFAULT_AI_CONFIG, requireKbGrounding: false };

describe("schedule gate", () => {
  test("draft-only window blocks auto-reply", () => {
    const config = { ...cfg, businessHours: {
      enabled: true, timezone: "Asia/Jakarta", defaultMode: "auto" as const,
      windows: [{ days: [3], start: "00:00", end: "23:59", mode: "draft-only" as const }],
    }};
    const d = canAutoReply(base, config, new Date("2026-06-17T03:00:00Z")); // Wed
    expect(d.allowed).toBe(false);
    expect(d.blockedReason).toMatch(/hours|jam|schedule/i);
  });
  test("auto window allows", () => {
    const config = { ...cfg, businessHours: {
      enabled: true, timezone: "Asia/Jakarta", defaultMode: "auto" as const, windows: [],
    }};
    expect(canAutoReply(base, config, new Date("2026-06-17T03:00:00Z")).allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run → FAIL** (signature has no `now`, `AiConfig` test type needs `businessHours` — already added in Task 4).
- [ ] **Step 3: Implement** — add `now: Date = new Date()` param; after the existing gates pass, before `return { allowed: true }`:

```ts
import { resolveReplyMode } from "@/lib/agent/business-hours";
// ...
  if (config.businessHours && resolveReplyMode(config.businessHours, now) === "draft-only") {
    return { allowed: false, blockedReason: "Outside auto-reply hours — drafted for staff review." };
  }
  return { allowed: true, blockedReason: null };
```

- [ ] **Step 4:** Update the one caller in `src/services/triage.service.ts` (the `canAutoReply(...)` call ~line 209 area) — no change needed if `now` defaults, but pass `new Date()` explicitly for clarity.
- [ ] **Step 5: Run → PASS.** `npm run typecheck`. **Commit** — `feat(agent): schedule-aware auto-reply gate`.

---

## Chunk 5: Routes, nav, server actions, UI

### Task 11: Server actions for the agent pages

**Files:** Create `src/actions/agent.actions.ts`

- [ ] **Step 0 (auth helper):** `knowledge.actions.ts` only does `getSession()` + `if (!session) throw` — there is **no** role check to mirror (admin enforcement is in `middleware.ts:30` + the sidebar filter). These actions write tool credentials, so add an **explicit** new helper in this file:

```ts
async function requireAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || !["owner", "admin"].includes(role ?? "")) throw new Error("Unauthorized");
  return session;
}
```

- [ ] **Step 1:** Every action calls `await requireAdminSession()` first. Implement:
  - `updateAgentBehaviorAction(data)` → `updateAiConfig` (behavior fields).
  - `updateAgentAutomationAction(data)` → `updateAiConfig` (gates + `businessHours`).
  - `listToolsAction` / `createToolAction` / `updateToolAction` / `deleteToolAction` / `testToolAction` → service.
  - `listCredentialsAction` / `createCredentialAction` / `deleteCredentialAction` (return non-secret fields only).
  - `revalidatePath("/app/agent")` (+ subpaths) after writes.
- [ ] **Step 2:** `npm run typecheck`. **Commit** — `feat(agent): server actions for behavior/automation/tools`.

### Task 12: Section layout + routes

**Files:** Create `src/app/app/agent/layout.tsx`, `page.tsx`, `automation/page.tsx`, `tools/page.tsx`; modify `src/middleware.ts:30`.

- [ ] **Step 1:** Add `/app/agent` to `adminRoutes` in middleware.
- [ ] **Step 2:** `layout.tsx` — server component; `getSession()` + admin redirect (mirror existing pages); render a horizontal sub-nav (Behavior / Automation / Tools / Procedures-disabled-"Segera") + `{children}`.
- [ ] **Step 3:** `page.tsx` (Behavior) — load `getAiConfig()`, render `<AgentBehaviorForm config={...} />`.
- [ ] **Step 4:** `automation/page.tsx` — load config, render `<AgentAutomationForm config={...} />` (the migrated gates + a business-hours editor).
- [ ] **Step 5:** `tools/page.tsx` — load `listToolsAction()` + `listCredentialsAction()`, render `<AgentToolsClient .../>`.
- [ ] **Step 6:** `npm run typecheck` + manual `npm run dev`, visit `/app/agent`. **Commit** — `feat(agent): /app/agent section routes + layout`.

### Task 13: Client forms

**Files:** Create `src/components/agent/agent-behavior-form.tsx`, `agent-automation-form.tsx`, `agent-tools-client.tsx`, `agent-tool-editor.tsx`.

- [ ] **Step 1:** `AgentBehaviorForm` — react-hook-form + zod (match `kb-article-form.tsx` patterns): name, persona (textarea), tone, language (select), signature, guardrails → `updateAgentBehaviorAction`, toast.
- [ ] **Step 2:** `AgentAutomationForm` — port the existing "Balasan Otomatis" + "Otomasi Triage" controls from `settings-dialog.tsx` (toggles, thresholds, channels, keywords) and add a business-hours editor (timezone, defaultMode, add/remove windows). Saves via `updateAgentAutomationAction`.
- [ ] **Step 3:** `AgentToolsClient` + `AgentToolEditor` — list tools (enabled toggle, type badge), create/edit dialog with a type switch (HTTP vs Exa) rendering the right config fields + a params editor (name/in/type/required) + credential picker + a "Test" button calling `testToolAction` and showing the JSON result.
- [ ] **Step 3b (window validation):** In the Automation form's business-hours editor, reject/disable saving any window where `start >= end` (cross-midnight windows are unsupported by `resolveReplyMode`) with an inline error. Prevents creating a silently-never-matching night window.
- [ ] **Step 4:** `npm run typecheck` + `npx eslint src/components/agent/*`. Manual smoke test each page. **Commit** — `feat(agent): behavior/automation/tools UI`.

### Task 14: Sidebar + settings cleanup

**Files:** Modify `src/components/helpdesk-sidebar.tsx`, `src/components/settings-dialog.tsx`.

- [ ] **Step 1:** Add to `LAINNYA_ITEMS`: `{ title: "AI Agent", url: "/app/agent", icon: <RiRobot2Line />, isLainnya: true, adminOnly: true }` (import an icon, e.g. `RiRobot2Line`).
- [ ] **Step 2:** Remove the "Perilaku AI" tab + its panel from `settings-dialog.tsx` (now lives at `/app/agent`). Leave Modules + SLA tabs intact. Verify no dangling imports/props.
- [ ] **Step 3:** `npm run typecheck` + lint. Manual: nav item appears for admins, settings dialog no longer shows AI tab. **Commit** — `feat(agent): surface AI Agent in nav, retire AI settings tab`.

---

## Chunk 6: Exa-in-copilot quick win

### Task 15: Web search action + copilot button

**Files:** Modify `src/actions/ai-copilot.actions.ts`, `src/components/tickets/ticket-ai-copilot-panel.tsx`.

- [ ] **Step 1:** Add `webSearchForTicketAction(ticketId, query)` — `requireSession()`, call `exaSearch(query || ticket.title, 5)`, return `{ title, url, snippet }[]`.
- [ ] **Step 2:** In the copilot panel, add a "Cari web" affordance (only meaningful when `EXA_API_KEY` set; failures toast gracefully) that renders results with external links beneath the KB results.
- [ ] **Step 3:** `npm run typecheck` + lint. Manual: button returns Exa results. **Commit** — `feat(copilot): Exa web search in the AI panel`.

---

## Phase 1 acceptance

- [ ] `npm run typecheck` clean; `bun test` green for all new `*.test.ts`.
- [ ] Migrations `0012`+`0013` are **hand-written SQL + journal entries** (do NOT run `drizzle-kit generate`, which would rewrite snapshots). Apply with `npx drizzle-kit migrate` and confirm it reads `meta/_journal.json`. `0013` uses `gen_random_uuid()` — already relied on by prior migrations (pgcrypto/pg13+), so no new extension needed. Nothing destructive.
- [ ] Admin sees **AI Agent** in nav; Behavior/Automation/Tools pages save and persist.
- [ ] A custom HTTP tool with a bearer credential can be created and **tested** from the UI; secret never leaves the server in plaintext.
- [ ] Business-hours `draft-only` window demonstrably suppresses auto-send (drafts instead).
- [ ] Exa search returns results in the copilot panel.
- [ ] "Perilaku AI" modal tab is gone; no duplicate controls.

---

## Phase 2 outline (procedures) — not yet task-decomposed

1. **Schema:** `agent_procedures` (`title`, `when_to_use`, `content` jsonb, `enabled`, `order`). Migration + journal + barrel export.
2. **Rich-text editor:** adopt TipTap/ProseMirror; custom inline nodes `tool-mention` (refs `agent_tools`) and `kb-mention` (refs KB doc/module); a `/Use` slash menu listing enabled tools + a "Create new tool" shortcut (mirrors the screenshot). Persist as JSON; render a read-only view.
3. **Procedure selection service:** given a ticket, an LLM (`generateObject`) ranks enabled procedures by `when_to_use` and returns the best match id + confidence (or none).
4. **Procedure execution:** `generateText` with `tools: await buildAgentTools()` and a system prompt assembled from agent Behavior + the selected procedure's steps + referenced KB content; capture the produced reply and an action (`send | draft-only | escalate`).
5. **Triage wiring:** in `triage.service.ts`, after KB search → try procedure selection/execution; on match use its output, else fall back to current KB-grounded path; then the existing (now schedule-aware) auto-reply gates apply.
6. **Activity/audit (optional):** log procedure used, tools called, and decision to `triageEvents` (or a new `agent_runs` table) and surface at `/app/agent/activity`.
7. **Guardrails:** max tool calls per ticket, never auto-send on a failed required tool, redact secrets from logs.

Decompose Phase 2 into a separate bite-sized plan once Phase 1 lands and the editor library is chosen.
