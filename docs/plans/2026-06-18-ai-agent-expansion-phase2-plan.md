# AI Agent Expansion — Phase 2 (Procedures) Implementation Plan

> **For agentic workers:** Use `subagent-driven-development`. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Environment constraints (learned in Phase 1 — do not relearn):**
> - **Subagents have NO shell permission.** They author files only. The **CONTROLLER** runs all verification (`bun run typecheck`, `bun test`, `npx eslint`) and all `git commit`s. For tasks whose code is fully specified here, author directly (faster); reserve subagents for judgment-heavy UI (the editor).
> - Use **`bun`**, not `npm`: `bun run typecheck`, `bun test`, `bun test <file>`. Tests are `bun:test`, colocated `*.test.ts`.
> - Lint: `npx eslint <files>`. There is ONE pre-existing eslint error on `main` in `src/components/tickets/ticket-ai-copilot-panel.tsx` (setState-in-effect, `runSearch`) — **ignore it**.
> - Commit trailer required: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
> - **Do NOT push or open a PR** without explicit user ask.
> - DB: user applies schema with **`bun drizzle-kit push`**, not `migrate`. Still write the SQL migration + journal entry for completeness, but expect `push`. When `push` asks "is X a rename of Y?" for genuinely-different columns, answer **no / create**.

**Goal:** Add Fin-style **Procedures** — rich-text playbooks the AI agent follows when a ticket semantically matches a procedure's "when to use" description — selected and executed inside triage, additive over today's KB fallback.

**Architecture:** A new `agent_procedures` table stores `title`, `when_to_use` (the semantic matcher), and `content` (a TipTap/ProseMirror JSON doc). The editor is **TipTap, minimal config**: StarterKit (no marks toolbar) + **one** custom inline `mention` node parameterized by a `kind` attribute (`tool | kb | module | time`) + a single `/` slash menu grouped by category (Knowledge / Integrations / Module / Time) with a "Create new…" shortcut. Pure helpers extract mention refs and serialize the doc to plain text for prompt assembly and read-only render. At triage time, a selection service (`generateObject`) ranks enabled procedures by `when_to_use`; on a match, an execution service runs `generateText` with `tools: await buildAgentTools()` and a system prompt assembled from agent Behavior + the procedure's serialized steps + referenced KB content, producing a reply that then flows through the existing schedule-aware auto-reply gates. No match → today's KB-grounded path. Nothing breaks.

**Tech Stack:** Next.js (App Router, RSC + server actions), Drizzle ORM (Postgres/Neon), `ai` v6 (`generateObject`, `generateText`, `tool`, `jsonSchema`), Zod v4, TipTap v3 (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/suggestion`, `@tiptap/static-renderer`), `bun:test`.

**Branch:** create `feat/ai-agent-phase2` from `feat/ai-agent-phase1`.

---

## Pre-flight (controller, once)

- [ ] **Confirm with the user that Phase 1's `bun drizzle-kit push` actually ran** (handoff flagged it may not have completed — `ai_configs` behavior columns + `agent_tools`/`agent_credentials` tables must exist). Do not start Chunk 1 schema work assuming they're present.
- [ ] `git checkout feat/ai-agent-phase1 && git pull` (no-op if local), then `git checkout -b feat/ai-agent-phase2`.
- [ ] Install editor deps (pinned to TipTap v3 line):
  ```bash
  bun add @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/suggestion @tiptap/static-renderer
  ```
  `@tiptap/pm` is the ProseMirror peer bundle; `@tiptap/static-renderer` powers the read-only render without an editor instance. **Commit** — `chore(agent): add TipTap editor deps for procedures`.

---

## Chunk 1: Schema + content model + pure helpers

This chunk has **no UI and no AI** — it is all pure, unit-testable code. Author directly; verify centrally.

### Task 1: `agent_procedures` table

**Files:**
- Modify: `src/db/schema/agent.ts`
- (barrel `src/db/schema/index.ts` already `export * from "./agent"` — no change needed)

- [ ] **Step 1:** Append to `src/db/schema/agent.ts` (keep imports; add `integer` to the drizzle import):

```typescript
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// ... existing agentCredentials, agentTools, agentToolsRelations unchanged ...

export const agentProcedures = pgTable(
  "agent_procedures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    // The semantic matcher the selection LLM reads to decide when to engage.
    whenToUse: text("when_to_use").notNull().default(""),
    // TipTap/ProseMirror JSON document. Custom inline `mention` nodes carry
    // attrs { kind: 'tool'|'kb'|'module'|'time', refId, label }.
    content: jsonb("content").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("agent_procedures_enabled_idx").on(t.enabled)]
);
```

- [ ] **Step 2:** Hand-write migration `src/db/migrations/0014_agent_procedures.sql` (mirror `0013` style; `gen_random_uuid()` already relied on):

```sql
CREATE TABLE IF NOT EXISTS "agent_procedures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "when_to_use" text DEFAULT '' NOT NULL,
  "content" jsonb NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_procedures_enabled_idx" ON "agent_procedures" ("enabled");
```

- [ ] **Step 3:** Add the journal entry to `src/db/migrations/meta/_journal.json` (append to `entries`, keep ascending `when`):

```json
{
  "idx": 14,
  "version": "7",
  "when": 1780400000000,
  "tag": "0014_agent_procedures",
  "breakpoints": true
}
```

- [ ] **Step 4 (controller):** `bun run typecheck`. Expected: clean (schema is type-only at this point).
- [ ] **Step 5 (controller):** **Commit** — `feat(agent): agent_procedures table + migration`.
- [ ] **Step 6 (controller, deferred):** After the user runs `bun drizzle-kit push`, confirm the `agent_procedures` table exists. Not a blocker for later code tasks (they're typechecked, not run against the DB until integration).

### Task 2: Procedure content model + pure helpers

These helpers are the contract every later layer depends on. **TDD strictly.**

**Files:**
- Create: `src/lib/agent/procedure-content.ts`
- Test: `src/lib/agent/procedure-content.test.ts`

The mention node shape (single node type, `kind`-discriminated):

```typescript
// A TipTap inline mention node as it appears inside `content`.
type MentionKind = "tool" | "kb" | "module" | "time";
// node = { type: "mention", attrs: { kind: MentionKind, refId: string | null, label: string } }
// `refId` is the agent_tools.id / knowledgeBase.id for tool|kb; null for module|time.
```

- [ ] **Step 1: Write the failing test** `src/lib/agent/procedure-content.test.ts`:

```typescript
import { test, expect } from "bun:test";
import {
  PROCEDURE_MENTION_KINDS,
  emptyProcedureContent,
  extractMentions,
  collectRefIds,
  serializeContentToText,
  type ProcedureContent,
} from "./procedure-content";

const doc: ProcedureContent = {
  type: "doc",
  content: [
    {
      type: "orderedList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Acknowledge the issue, then " },
                { type: "mention", attrs: { kind: "tool", refId: "tool-1", label: "Get order info" } },
                { type: "text", text: " and ground in " },
                { type: "mention", attrs: { kind: "kb", refId: "kb-9", label: "Refund policy" } },
              ],
            },
          ],
        },
      ],
    },
  ],
};

test("kinds are the four agreed categories", () => {
  expect([...PROCEDURE_MENTION_KINDS]).toEqual(["tool", "kb", "module", "time"]);
});

test("emptyProcedureContent is a valid empty doc", () => {
  expect(emptyProcedureContent().type).toBe("doc");
});

test("extractMentions walks the whole tree depth-first", () => {
  const mentions = extractMentions(doc);
  expect(mentions.map((m) => m.kind)).toEqual(["tool", "kb"]);
  expect(mentions.map((m) => m.refId)).toEqual(["tool-1", "kb-9"]);
});

test("collectRefIds dedupes by kind", () => {
  expect(collectRefIds(doc, "tool")).toEqual(["tool-1"]);
  expect(collectRefIds(doc, "kb")).toEqual(["kb-9"]);
  expect(collectRefIds(doc, "module")).toEqual([]);
});

test("serializeContentToText renders mentions as readable tokens and numbers steps", () => {
  const text = serializeContentToText(doc);
  expect(text).toContain("1. Acknowledge the issue, then [Tool: Get order info] and ground in [KB: Refund policy]");
});

test("serializeContentToText is robust to malformed/empty input", () => {
  expect(serializeContentToText(emptyProcedureContent())).toBe("");
  expect(serializeContentToText({} as ProcedureContent)).toBe("");
});
```

- [ ] **Step 2 (controller): Run test, verify it fails** — `bun test src/lib/agent/procedure-content.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Write `src/lib/agent/procedure-content.ts`:**

```typescript
export const PROCEDURE_MENTION_KINDS = ["tool", "kb", "module", "time"] as const;
export type MentionKind = (typeof PROCEDURE_MENTION_KINDS)[number];

export type MentionAttrs = { kind: MentionKind; refId: string | null; label: string };

// Minimal structural type for a ProseMirror/TipTap JSON node. We only read it.
export type ProseNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: ProseNode[];
};
export type ProcedureContent = ProseNode;

export function emptyProcedureContent(): ProcedureContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

function isMention(node: ProseNode): node is ProseNode & { attrs: MentionAttrs } {
  return (
    node.type === "mention" &&
    typeof node.attrs?.kind === "string" &&
    (PROCEDURE_MENTION_KINDS as readonly string[]).includes(node.attrs.kind as string)
  );
}

/** Depth-first list of every mention node's attrs, in document order. */
export function extractMentions(content: ProcedureContent | null | undefined): MentionAttrs[] {
  const out: MentionAttrs[] = [];
  const walk = (node?: ProseNode) => {
    if (!node || typeof node !== "object") return;
    if (isMention(node)) {
      out.push({
        kind: node.attrs.kind,
        refId: (node.attrs.refId as string | null) ?? null,
        label: String(node.attrs.label ?? ""),
      });
    }
    node.content?.forEach(walk);
  };
  walk(content ?? undefined);
  return out;
}

/** Unique, non-null refIds of one kind, in first-seen order. */
export function collectRefIds(content: ProcedureContent | null | undefined, kind: MentionKind): string[] {
  const seen = new Set<string>();
  for (const m of extractMentions(content)) {
    if (m.kind === kind && m.refId) seen.add(m.refId);
  }
  return [...seen];
}

const KIND_LABEL: Record<MentionKind, string> = {
  tool: "Tool",
  kb: "KB",
  module: "Module",
  time: "Time",
};

function mentionToken(attrs: MentionAttrs): string {
  // `module`/`time` have no label of their own → just the kind tag.
  if (attrs.kind === "module") return "[Module]";
  if (attrs.kind === "time") return "[Current time]";
  return `[${KIND_LABEL[attrs.kind]}: ${attrs.label}]`;
}

function inlineText(nodes: ProseNode[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((n) => {
      if (n.type === "text") return n.text ?? "";
      if (isMention(n)) return mentionToken({ kind: n.attrs.kind, refId: (n.attrs.refId as string) ?? null, label: String(n.attrs.label ?? "") });
      return inlineText(n.content);
    })
    .join("");
}

/**
 * Flatten a procedure doc into plain text for prompt assembly + read-only
 * fallbacks. Ordered-list items are numbered; paragraphs are newline-separated.
 * Mentions become readable tokens (e.g. "[Tool: Get order info]"). Never throws.
 */
export function serializeContentToText(content: ProcedureContent | null | undefined): string {
  if (!content || typeof content !== "object") return "";
  const lines: string[] = [];
  const renderBlock = (node: ProseNode, listIndex?: number) => {
    switch (node.type) {
      case "orderedList": {
        node.content?.forEach((li, i) => renderBlock(li, i + 1));
        return;
      }
      case "bulletList": {
        node.content?.forEach((li) => renderBlock(li));
        return;
      }
      case "listItem": {
        const inner = (node.content ?? []).map((c) => inlineText(c.content)).join(" ").trim();
        if (inner) lines.push(listIndex ? `${listIndex}. ${inner}` : `- ${inner}`);
        return;
      }
      case "paragraph": {
        const t = inlineText(node.content).trim();
        if (t) lines.push(t);
        return;
      }
      default:
        node.content?.forEach((c) => renderBlock(c));
    }
  };
  (content.content ?? []).forEach((n) => renderBlock(n));
  return lines.join("\n");
}
```

- [ ] **Step 4 (controller): Run test, verify it passes** — `bun test src/lib/agent/procedure-content.test.ts`. Expected: PASS (6 tests).
- [ ] **Step 5 (controller):** `npx eslint src/lib/agent/procedure-content.ts src/lib/agent/procedure-content.test.ts`. Expected: clean.
- [ ] **Step 6 (controller): Commit** — `feat(agent): procedure content model + serialization helpers`.

> **Chunk 1 review gate:** dispatch `plan-document-reviewer` on this chunk before proceeding (see review loop at end).

---

## Chunk 2: Procedures CRUD service, mention sources, server actions

### Task 3: Procedures service

**Files:**
- Create: `src/services/agent-procedures.service.ts`
- Test: `src/services/agent-procedures.service.test.ts` (pure validation only — DB calls are integration, not unit)

- [ ] **Step 1: Write the failing test** for the pure input validator:

```typescript
import { test, expect } from "bun:test";
import { normalizeProcedureInput } from "./agent-procedures.service";

test("normalizeProcedureInput trims title/whenToUse and defaults content", () => {
  const out = normalizeProcedureInput({ title: "  Damaged order  ", whenToUse: "  use when... ", content: undefined });
  expect(out.title).toBe("Damaged order");
  expect(out.whenToUse).toBe("use when...");
  expect(out.content).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
});

test("normalizeProcedureInput rejects an empty title", () => {
  expect(() => normalizeProcedureInput({ title: "   ", whenToUse: "x", content: {} })).toThrow();
});
```

- [ ] **Step 2 (controller):** `bun test src/services/agent-procedures.service.test.ts` → FAIL (module not found).

- [ ] **Step 3: Write `src/services/agent-procedures.service.ts`:**

```typescript
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentProcedures } from "@/db/schema/agent";
import { emptyProcedureContent, type ProcedureContent } from "@/lib/agent/procedure-content";

export type AgentProcedureRow = typeof agentProcedures.$inferSelect;

export type ProcedureInput = {
  title: string;
  whenToUse?: string;
  content?: unknown;
  enabled?: boolean;
  order?: number;
};

/** Pure, testable normalization/validation of procedure form input. */
export function normalizeProcedureInput(data: ProcedureInput) {
  const title = (data.title ?? "").trim();
  if (!title) throw new Error("Judul prosedur wajib diisi.");
  const content =
    data.content && typeof data.content === "object"
      ? (data.content as ProcedureContent)
      : emptyProcedureContent();
  return {
    title,
    whenToUse: (data.whenToUse ?? "").trim(),
    content,
    enabled: data.enabled ?? true,
    order: Number.isFinite(data.order) ? Math.trunc(data.order as number) : 0,
  };
}

export async function listProcedures(): Promise<AgentProcedureRow[]> {
  return db.select().from(agentProcedures).orderBy(asc(agentProcedures.order), asc(agentProcedures.createdAt)).execute();
}

/** Enabled procedures only — what selection/execution and the runtime read. */
export async function listEnabledProcedures(): Promise<AgentProcedureRow[]> {
  return db
    .select()
    .from(agentProcedures)
    .where(eq(agentProcedures.enabled, true))
    .orderBy(asc(agentProcedures.order), asc(agentProcedures.createdAt))
    .execute();
}

export async function getProcedure(id: string): Promise<AgentProcedureRow | null> {
  const [row] = await db.select().from(agentProcedures).where(eq(agentProcedures.id, id));
  return row ?? null;
}

export async function createProcedure(data: ProcedureInput): Promise<AgentProcedureRow> {
  const v = normalizeProcedureInput(data);
  const [row] = await db.insert(agentProcedures).values(v).returning();
  return row;
}

export async function updateProcedure(id: string, data: Partial<ProcedureInput>): Promise<AgentProcedureRow> {
  const patch: Partial<typeof agentProcedures.$inferInsert> = { updatedAt: new Date() };
  if (data.title !== undefined) {
    const t = data.title.trim();
    if (!t) throw new Error("Judul prosedur wajib diisi.");
    patch.title = t;
  }
  if (data.whenToUse !== undefined) patch.whenToUse = data.whenToUse.trim();
  if (data.content !== undefined && typeof data.content === "object")
    patch.content = data.content as ProcedureContent;
  if (data.enabled !== undefined) patch.enabled = data.enabled;
  if (data.order !== undefined) patch.order = Math.trunc(data.order);
  const [row] = await db.update(agentProcedures).set(patch).where(eq(agentProcedures.id, id)).returning();
  return row;
}

export async function deleteProcedure(id: string): Promise<void> {
  await db.delete(agentProcedures).where(eq(agentProcedures.id, id)).execute();
}
```

- [ ] **Step 4 (controller):** `bun test src/services/agent-procedures.service.test.ts` → PASS (2 tests). Then `bun run typecheck`.
- [ ] **Step 5 (controller): Commit** — `feat(agent): agent_procedures CRUD service`.

### Task 4: Mention-source provider (what the `/` menu lists)

The editor's slash menu needs the candidate items for each category. Knowledge + Integrations are dynamic (DB); Module + Time are static singletons.

**Files:**
- Create: `src/services/agent-mention-sources.service.ts`

- [ ] **Step 1:** Write the service (no test — thin DB read mapping; covered by typecheck + manual):

```typescript
import { listTools } from "./agent-tools.service";
import { getAllKbArticles } from "./knowledge.service";
import type { MentionKind } from "@/lib/agent/procedure-content";

export type MentionSource = { kind: MentionKind; refId: string | null; label: string; hint?: string };

/**
 * All choices the editor's `/` menu can insert, grouped by kind.
 * - tool: enabled agent_tools (refId = tool id)
 * - kb:   KB articles (refId = article id)
 * - module / time: single contextual tokens resolved at runtime (refId null)
 */
export async function getMentionSources(): Promise<MentionSource[]> {
  const [tools, kbs] = await Promise.all([listTools(), getAllKbArticles()]);
  const out: MentionSource[] = [];
  for (const t of tools) {
    if (t.enabled) out.push({ kind: "tool", refId: t.id, label: t.name, hint: t.description });
  }
  for (const a of kbs) out.push({ kind: "kb", refId: a.id, label: a.title });
  out.push({ kind: "module", refId: null, label: "Modul tiket", hint: "Modul/kategori tiket saat runtime" });
  out.push({ kind: "time", refId: null, label: "Waktu sekarang", hint: "Tanggal & jam saat eksekusi" });
  return out;
}
```

> Note: `getAllKbArticles` returns full rows incl. `content`; map to `{id,title}` only at the action layer (Task 5) so the client never receives KB bodies.

- [ ] **Step 2 (controller):** `bun run typecheck`. **Commit** — `feat(agent): mention-source provider for procedure editor`.

### Task 5: Server actions

**Files:**
- Modify: `src/actions/agent.actions.ts`

- [ ] **Step 1:** Add procedure + mention-source actions (every action calls `await requireAdminSession()` first; reuse existing `revalidateAgent` and add `/app/agent/procedures` to it):

```typescript
// add to imports
import {
  listProcedures,
  getProcedure,
  createProcedure,
  updateProcedure,
  deleteProcedure,
  type ProcedureInput,
} from "@/services/agent-procedures.service";
import { getMentionSources } from "@/services/agent-mention-sources.service";

// extend revalidateAgent():
function revalidateAgent() {
  revalidatePath("/app/agent");
  revalidatePath("/app/agent/automation");
  revalidatePath("/app/agent/tools");
  revalidatePath("/app/agent/procedures");
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

// Mention sources for the `/` menu. KB bodies are stripped here.
export async function getMentionSourcesAction() {
  await requireAdminSession();
  return getMentionSources();
}
```

- [ ] **Step 2 (controller):** `bun run typecheck` + `npx eslint src/actions/agent.actions.ts`.
- [ ] **Step 3 (controller): Commit** — `feat(agent): server actions for procedures + mention sources`.

> **Chunk 2 review gate.**

---

## Chunk 3: Procedure selection + execution services

This is the runtime brain. Pure prompt-assembly is unit-tested; the AI calls are integration-tested with a mocked model (mirror how existing `triage-ai` functions are structured, but keep AI calls injectable).

### Task 6: Procedure selection service

**Files:**
- Create: `src/services/procedure-selection.service.ts`
- Test: `src/services/procedure-selection.service.test.ts`

- [ ] **Step 1: Write the failing test** for the pure ranker prompt + the public contract using an injected `generateObject`:

```typescript
import { test, expect } from "bun:test";
import { buildSelectionPrompt, pickProcedure } from "./procedure-selection.service";

const procs = [
  { id: "p1", title: "Damaged order", whenToUse: "customer reports a damaged/spilled food order" },
  { id: "p2", title: "Refund status", whenToUse: "customer asks where their refund is" },
];

test("buildSelectionPrompt lists every candidate with id + when_to_use", () => {
  const p = buildSelectionPrompt("My food arrived crushed", procs);
  expect(p).toContain("p1");
  expect(p).toContain("damaged/spilled food order");
  expect(p).toContain("My food arrived crushed");
});

test("pickProcedure returns the model's choice when confident", async () => {
  const fakeGenerate = async () => ({ object: { procedureId: "p1", confidence: 0.9, reasoning: "match" } });
  const res = await pickProcedure("crushed food", procs, { generate: fakeGenerate, minConfidence: 0.6 });
  expect(res?.procedureId).toBe("p1");
});

test("pickProcedure returns null below the confidence floor", async () => {
  const fakeGenerate = async () => ({ object: { procedureId: "p1", confidence: 0.3, reasoning: "weak" } });
  const res = await pickProcedure("crushed food", procs, { generate: fakeGenerate, minConfidence: 0.6 });
  expect(res).toBeNull();
});

test("pickProcedure returns null when the model declines (null id)", async () => {
  const fakeGenerate = async () => ({ object: { procedureId: null, confidence: 0, reasoning: "none" } });
  const res = await pickProcedure("hello", procs, { generate: fakeGenerate, minConfidence: 0.6 });
  expect(res).toBeNull();
});

test("pickProcedure short-circuits with no candidates (no model call)", async () => {
  let called = false;
  const fakeGenerate = async () => { called = true; return { object: { procedureId: null, confidence: 0, reasoning: "" } }; };
  const res = await pickProcedure("anything", [], { generate: fakeGenerate, minConfidence: 0.6 });
  expect(res).toBeNull();
  expect(called).toBe(false);
});
```

- [ ] **Step 2 (controller):** `bun test src/services/procedure-selection.service.test.ts` → FAIL.

- [ ] **Step 3: Write `src/services/procedure-selection.service.ts`:**

```typescript
import { generateObject } from "ai";
import { z } from "zod";
import { getAiModel } from "@/lib/ai";

export type SelectionCandidate = { id: string; title: string; whenToUse: string };

export const ProcedureSelectionSchema = z.object({
  procedureId: z.string().nullable().describe("ID of the best-matching procedure, or null if none fit."),
  confidence: z.number().min(0).max(1).describe("Confidence 0.0–1.0 that this procedure applies."),
  reasoning: z.string().describe("Brief reason in Indonesian."),
});
export type ProcedureSelection = z.infer<typeof ProcedureSelectionSchema>;

export function buildSelectionPrompt(ticketText: string, candidates: SelectionCandidate[]): string {
  const list = candidates
    .map((c) => `- ID: ${c.id} | Judul: ${c.title} | Kapan dipakai: ${c.whenToUse || "(tidak diisi)"}`)
    .join("\n");
  return `Kamu adalah router prosedur untuk agen AI helpdesk SIMRS RSUD Karawang.

Tiket masuk:
${ticketText}

Daftar prosedur yang tersedia:
${list}

Pilih SATU prosedur yang paling sesuai dengan tiket berdasarkan deskripsi "Kapan dipakai".
Jika tidak ada yang benar-benar cocok, kembalikan procedureId = null. Jangan memaksakan kecocokan.`;
}

type GenerateFn = (args: { model?: unknown; schema?: unknown; prompt: string }) => Promise<{ object: ProcedureSelection }>;

export async function pickProcedure(
  ticketText: string,
  candidates: SelectionCandidate[],
  opts?: { generate?: GenerateFn; minConfidence?: number },
): Promise<{ procedureId: string; confidence: number; reasoning: string } | null> {
  if (candidates.length === 0) return null;
  const minConfidence = opts?.minConfidence ?? 0.6;
  const generate =
    opts?.generate ??
    ((args) => generateObject({ model: getAiModel(), schema: ProcedureSelectionSchema, prompt: args.prompt }));

  const { object } = await generate({ prompt: buildSelectionPrompt(ticketText, candidates) });
  if (!object.procedureId) return null;
  if (object.confidence < minConfidence) return null;
  // Guard against a hallucinated id not in the candidate set.
  if (!candidates.some((c) => c.id === object.procedureId)) return null;
  return { procedureId: object.procedureId, confidence: object.confidence, reasoning: object.reasoning };
}
```

- [ ] **Step 4 (controller):** `bun test src/services/procedure-selection.service.test.ts` → PASS (5). Then `bun run typecheck`.
- [ ] **Step 5 (controller): Commit** — `feat(agent): procedure selection service`.

### Task 7: Procedure execution service

Assembles the system prompt from Behavior + serialized procedure + referenced KB grounding, runs a bounded `generateText` tool-calling loop, and returns `{ reply, action, toolCalls, hadToolError }`. Pure prompt assembly is unit-tested; the loop is integration-tested with an injected `generateText`.

**Files:**
- Create: `src/services/procedure-execution.service.ts`
- Test: `src/services/procedure-execution.service.test.ts`

- [ ] **Step 1: Write the failing test:**

```typescript
import { test, expect } from "bun:test";
import { assembleSystemPrompt, runProcedure, MAX_PROCEDURE_STEPS } from "./procedure-execution.service";

const behavior = { agentName: "Asisten", persona: "Ramah", tone: "Sopan", language: "id", replySignature: "- Tim Support", guardrails: "Jangan janjikan refund." };

test("assembleSystemPrompt embeds behavior, steps text, and KB grounding", () => {
  const sys = assembleSystemPrompt({
    behavior,
    procedureTitle: "Damaged order",
    stepsText: "1. Acknowledge\n2. [Tool: Get order info]",
    kbGrounding: [{ title: "Refund policy", content: "Refunds within 7 days." }],
    moduleName: "Pesanan",
  });
  expect(sys).toContain("Asisten");
  expect(sys).toContain("Damaged order");
  expect(sys).toContain("Get order info");
  expect(sys).toContain("Refunds within 7 days");
  expect(sys).toContain("Jangan janjikan refund");
  expect(sys).toContain("Pesanan");
});

test("runProcedure returns the model text as the reply and counts tool calls", async () => {
  const fakeGenerate = async () => ({
    text: "Halo, kami akan bantu.",
    steps: [{ toolCalls: [{ toolName: "get_order" }], toolResults: [{ result: { ok: true } }] }],
  });
  const res = await runProcedure({
    ticketText: "Pesanan rusak",
    behavior, procedureTitle: "x", stepsText: "1. acknowledge", kbGrounding: [], moduleName: null,
    tools: {}, generate: fakeGenerate,
  });
  expect(res.reply).toBe("Halo, kami akan bantu.");
  expect(res.toolCalls).toBe(1);
  expect(res.hadToolError).toBe(false);
});

test("runProcedure flags a tool error so the caller can force draft-only", async () => {
  const fakeGenerate = async () => ({
    text: "draft",
    steps: [{ toolCalls: [{ toolName: "get_order" }], toolResults: [{ result: { ok: false, error: "boom" } }] }],
  });
  const res = await runProcedure({
    ticketText: "x", behavior, procedureTitle: "x", stepsText: "x", kbGrounding: [], moduleName: null,
    tools: {}, generate: fakeGenerate,
  });
  expect(res.hadToolError).toBe(true);
});

test("MAX_PROCEDURE_STEPS is a small bound", () => {
  expect(MAX_PROCEDURE_STEPS).toBeLessThanOrEqual(6);
});
```

- [ ] **Step 2 (controller):** `bun test src/services/procedure-execution.service.test.ts` → FAIL.

- [ ] **Step 3: Write `src/services/procedure-execution.service.ts`:**

```typescript
import { generateText, stepCountIs, type ToolSet } from "ai";
import { getAiModel } from "@/lib/ai";

export const MAX_PROCEDURE_STEPS = 5; // bounds tool-calling loop (guardrail: max calls/ticket)

export type ProcedureBehavior = {
  agentName: string; persona: string; tone: string; language: string; replySignature: string; guardrails: string;
};
export type KbGroundingDoc = { title: string; content: string };

export function assembleSystemPrompt(input: {
  behavior: ProcedureBehavior;
  procedureTitle: string;
  stepsText: string;
  kbGrounding: KbGroundingDoc[];
  moduleName: string | null;
}): string {
  const { behavior, procedureTitle, stepsText, kbGrounding, moduleName } = input;
  const kb = kbGrounding.length
    ? kbGrounding.map((d) => `### ${d.title}\n${d.content.slice(0, 1500)}`).join("\n\n")
    : "(tidak ada artikel KB yang dirujuk)";
  return `Kamu adalah ${behavior.agentName || "asisten AI"}, agen helpdesk SIMRS RSUD Karawang.
${behavior.persona ? `Peran/persona: ${behavior.persona}` : ""}
${behavior.tone ? `Nada bicara: ${behavior.tone}` : ""}
Bahasa balasan: ${behavior.language || "id"}.
${behavior.guardrails ? `Batasan WAJIB: ${behavior.guardrails}` : ""}
${moduleName ? `Modul tiket: ${moduleName}.` : ""}

Ikuti PROSEDUR berikut langkah demi langkah ("${procedureTitle}"):
${stepsText}

Saat sebuah langkah menyebut [Tool: ...], panggil tool yang sesuai. Saat menyebut [KB: ...],
dasarkan jawabanmu HANYA pada materi KB di bawah. Jangan mengarang fakta di luar KB/hasil tool.

Materi Knowledge Base yang dirujuk:
${kb}

Tulis balasan akhir untuk pelapor dalam Bahasa Indonesia${behavior.replySignature ? `, akhiri dengan tanda tangan: ${behavior.replySignature}` : ""}.`;
}

type GenerateTextResult = { text: string; steps?: { toolCalls?: unknown[]; toolResults?: { result?: unknown }[] }[] };
type GenerateTextFn = (args: {
  model?: unknown; system: string; prompt: string; tools: ToolSet; stopWhen?: unknown;
}) => Promise<GenerateTextResult>;

export type ProcedureRunResult = {
  reply: string;
  action: "send" | "draft-only" | "escalate";
  toolCalls: number;
  hadToolError: boolean;
};

export async function runProcedure(input: {
  ticketText: string;
  behavior: ProcedureBehavior;
  procedureTitle: string;
  stepsText: string;
  kbGrounding: KbGroundingDoc[];
  moduleName: string | null;
  tools: ToolSet;
  generate?: GenerateTextFn;
}): Promise<ProcedureRunResult> {
  const system = assembleSystemPrompt(input);
  const generate =
    input.generate ??
    ((args) => generateText({ model: getAiModel(), system: args.system, prompt: args.prompt, tools: args.tools, stopWhen: args.stopWhen }) as Promise<GenerateTextResult>);

  const result = await generate({
    system,
    prompt: input.ticketText,
    tools: input.tools,
    stopWhen: stepCountIs(MAX_PROCEDURE_STEPS),
  });

  let toolCalls = 0;
  let hadToolError = false;
  for (const step of result.steps ?? []) {
    toolCalls += step.toolCalls?.length ?? 0;
    for (const r of step.toolResults ?? []) {
      const res = r.result as { ok?: boolean } | undefined;
      if (res && res.ok === false) hadToolError = true;
    }
  }

  // Guardrail: never auto-send a reply built on a failed tool call.
  const action: ProcedureRunResult["action"] = hadToolError ? "draft-only" : "send";
  return { reply: (result.text ?? "").trim(), action, toolCalls, hadToolError };
}
```

- [ ] **Step 4 (controller):** `bun test src/services/procedure-execution.service.test.ts` → PASS (4). Then `bun run typecheck`.
- [ ] **Step 5 (controller): Commit** — `feat(agent): procedure execution service (tool-calling loop)`.

> **Chunk 3 review gate.** Verify against `ai` v6 API: confirm `generateText` returns `steps[]` with `toolCalls`/`toolResults` and that `stopWhen: stepCountIs(n)` is the v6 spelling (Phase 1 notes `ai` is v6; if the shape differs, adjust the `GenerateTextResult` type + accumulation, keeping tests green). Use Context7 (`/ueberdosis`… no — `vercel/ai`) if unsure.

---

## Chunk 4: Triage wiring + guardrails

### Task 8: Orchestrator that ties selection → execution → grounding

A thin service so `triage.service.ts` stays readable and the orchestration is unit-testable.

**Files:**
- Create: `src/services/procedure-runtime.service.ts`
- Test: `src/services/procedure-runtime.service.test.ts`

- [ ] **Step 1: Write the failing test** (inject selection + execution + KB loader so no DB/AI is hit):

```typescript
import { test, expect } from "bun:test";
import { tryProcedure } from "./procedure-runtime.service";

const baseDeps = {
  listEnabled: async () => [
    { id: "p1", title: "Damaged order", whenToUse: "damaged food", content: { type: "doc", content: [] }, enabled: true, order: 0, createdAt: new Date(), updatedAt: new Date() },
  ],
  select: async () => ({ procedureId: "p1", confidence: 0.9, reasoning: "ok" }),
  loadKb: async () => [],
  buildTools: async () => ({}),
  run: async () => ({ reply: "Halo", action: "send" as const, toolCalls: 0, hadToolError: false }),
};

const behavior = { agentName: "A", persona: "", tone: "", language: "id", replySignature: "", guardrails: "" };

test("tryProcedure returns null when no procedure is selected", async () => {
  const res = await tryProcedure({ ticketText: "x", moduleName: null, behavior }, { ...baseDeps, select: async () => null });
  expect(res).toBeNull();
});

test("tryProcedure returns the executed reply + matched procedure", async () => {
  const res = await tryProcedure({ ticketText: "damaged", moduleName: "Pesanan", behavior }, baseDeps);
  expect(res?.reply).toBe("Halo");
  expect(res?.procedureId).toBe("p1");
  expect(res?.action).toBe("send");
});

test("tryProcedure returns null when there are no enabled procedures", async () => {
  const res = await tryProcedure({ ticketText: "x", moduleName: null, behavior }, { ...baseDeps, listEnabled: async () => [] });
  expect(res).toBeNull();
});
```

- [ ] **Step 2 (controller):** `bun test src/services/procedure-runtime.service.test.ts` → FAIL.

- [ ] **Step 3: Write `src/services/procedure-runtime.service.ts`** (default deps wire the real services; tests inject fakes):

```typescript
import type { ToolSet } from "ai";
import { listEnabledProcedures, type AgentProcedureRow } from "./agent-procedures.service";
import { pickProcedure } from "./procedure-selection.service";
import { runProcedure, type ProcedureBehavior, type KbGroundingDoc, type ProcedureRunResult } from "./procedure-execution.service";
import { buildAgentTools } from "./agent-tool-executor.service";
import { getKbArticleById } from "./knowledge.service";
import { collectRefIds, serializeContentToText, type ProcedureContent } from "@/lib/agent/procedure-content";

export type ProcedureRuntimeResult = ProcedureRunResult & { procedureId: string; procedureTitle: string; confidence: number };

type Deps = {
  listEnabled: () => Promise<AgentProcedureRow[]>;
  select: typeof pickProcedure;
  loadKb: (ids: string[]) => Promise<KbGroundingDoc[]>;
  buildTools: () => Promise<ToolSet>;
  run: typeof runProcedure;
};

const defaultDeps: Deps = {
  listEnabled: listEnabledProcedures,
  select: pickProcedure,
  loadKb: async (ids) => {
    const docs = await Promise.all(ids.map((id) => getKbArticleById(id)));
    return docs.flatMap((d) => (d ? [{ title: d.title, content: d.content ?? "" }] : []));
  },
  buildTools: buildAgentTools,
  run: runProcedure,
};

export async function tryProcedure(
  input: { ticketText: string; moduleName: string | null; behavior: ProcedureBehavior },
  deps: Partial<Deps> = {},
): Promise<ProcedureRuntimeResult | null> {
  const d = { ...defaultDeps, ...deps };
  const procedures = await d.listEnabled();
  if (procedures.length === 0) return null;

  const selection = await d.select(
    input.ticketText,
    procedures.map((p) => ({ id: p.id, title: p.title, whenToUse: p.whenToUse })),
  );
  if (!selection) return null;

  const matched = procedures.find((p) => p.id === selection.procedureId);
  if (!matched) return null;

  const content = matched.content as ProcedureContent;
  const kbGrounding = await d.loadKb(collectRefIds(content, "kb"));
  const tools = await d.buildTools();

  const run = await d.run({
    ticketText: input.ticketText,
    behavior: input.behavior,
    procedureTitle: matched.title,
    stepsText: serializeContentToText(content),
    kbGrounding,
    moduleName: input.moduleName,
    tools,
  });

  return { ...run, procedureId: matched.id, procedureTitle: matched.title, confidence: selection.confidence };
}
```

- [ ] **Step 4 (controller):** `bun test src/services/procedure-runtime.service.test.ts` → PASS (3). Then `bun run typecheck`.
- [ ] **Step 5 (controller): Commit** — `feat(agent): procedure runtime orchestrator`.

### Task 9: Wire into `triage.service.ts`

Insert procedure attempt **after** KB search produces `result.suggestedReply`, **before** the policy gate. On a match, the procedure output **replaces** the KB suggestion; on no match, the existing KB path is untouched. The `hadToolError → draft-only` guardrail is honored by suppressing auto-send.

**Files:**
- Modify: `src/services/triage.service.ts`

- [ ] **Step 1:** Add the import near the other service imports:

```typescript
import { tryProcedure } from "@/services/procedure-runtime.service";
```

- [ ] **Step 2:** Extend `TriageResult` with procedure provenance + add a local flag. After the `kbMatches` block (around line 170, before the `Promise.all` writes), insert:

```typescript
    // --- Procedure attempt (additive; falls back to KB suggestion on no match) ---
    let procedureForceDraft = false;
    try {
      const proc = await tryProcedure(
        { ticketText: searchQuery, moduleName: classifiedModuleName, behavior: {
            agentName: config.agentName, persona: config.persona, tone: config.tone,
            language: config.language, replySignature: config.replySignature, guardrails: config.guardrails,
        } },
      );
      if (proc && proc.reply) {
        result.suggestedReply = proc.reply;
        result.replyConfidence = proc.confidence;
        result.procedureId = proc.procedureId;
        result.procedureTitle = proc.procedureTitle;
        // Guardrail: a procedure that escalates or hit a failed tool must never auto-send.
        if (proc.action !== "send") procedureForceDraft = true;
      }
    } catch (procErr) {
      // Never let a procedure failure break triage — fall back to the KB suggestion.
      console.error(`[AI] Procedure attempt failed for ticket ${ticketId}:`, procErr);
    }
```

  Add to the `TriageResult` type:

```typescript
  procedureId: string | null;
  procedureTitle: string | null;
```

  and initialize both to `null` in the `result` object literal.

- [ ] **Step 3:** Honor the guardrail at the send site. Change the auto-send condition:

```typescript
    if (policy.allowed && result.suggestedReply && !procedureForceDraft) {
      // ... existing delayed-queue / immediate-send branch unchanged ...
    }
```

  And when `procedureForceDraft` is true, set a clear reason for the event:

```typescript
    if (procedureForceDraft) {
      autoReplyBlockedReason =
        autoReplyBlockedReason ?? "Prosedur meminta draf saja (eskalasi atau tool gagal).";
    }
```

- [ ] **Step 4:** Persist procedure provenance in the `completed` triage event (add two columns OR fold into existing reason fields). **Minimal, no-migration option:** append to `moduleReason`/`priorityReason`-style logging by extending `suggestedReply` provenance into the existing `triageEvents` insert via a new nullable text — but to avoid schema churn, log it in `autoReplyBlockedReason`/console only for now. **Chosen approach:** add to the `completed` event insert a human-readable note when a procedure ran:

```typescript
      // inside the completed triageEvents insert, reuse an existing nullable text column:
      // (procedure provenance is surfaced via the optional Activity page later)
```

  > Decision for the executor: keep Task 9 schema-free. Procedure id/title live on the in-memory `TriageResult` (returned to callers) and in `console`/`autoReplyBlockedReason`. The durable audit (a column or `agent_runs` table) is **Task 12 (optional)**. This keeps the triage wiring a pure behavior change with zero migration.

- [ ] **Step 5 (controller):** `bun run typecheck` + `npx eslint src/services/triage.service.ts`.
- [ ] **Step 6 (controller): Commit** — `feat(agent): run matching procedures inside triage with draft-only guardrail`.

### Task 10: Triage integration test (procedure path)

**Files:**
- Create/extend: `src/services/triage.procedure.test.ts` (only if a DB-free seam exists). If `triageTicket` can't be unit-tested without a DB (it can't — it does real `db` calls), **skip a full integration test here** and instead rely on the orchestrator test (Task 8) + a manual smoke test. Document the manual check:

- [ ] **Step 1 (controller, manual):** With `bun run dev`, create an enabled procedure whose `when_to_use` matches a test ticket, trigger triage (intake or manual re-run), and confirm via `triage_events` / the ticket thread that the procedure reply (not the KB suggestion) was used, and that a forced-draft procedure does not auto-send.
- [ ] **Step 2 (controller):** No commit (verification only) unless a seam was added.

> **Chunk 4 review gate.**

---

## Chunk 5: The editor (TipTap) — judgment-heavy UI (use a subagent)

> Dispatch a subagent for Task 11 (UI taste matters). The subagent **authors files only**; the controller installs nothing new (deps already added), runs typecheck/eslint, and commits.

### Task 11a: The custom mention node

**Files:**
- Create: `src/components/agent/procedure-editor/mention-node.tsx`

- [ ] **Step 1:** Define one `Node` named `mention`, `group: "inline"`, `inline: true`, `atom: true`, `selectable: true`, with attributes `kind`, `refId`, `label`. Use `ReactNodeViewRenderer` to render a colored chip per `kind` (tool=violet, kb=amber, module=blue, time=slate), each prefixed with a tiny kind glyph, mirroring the screenshot's connector chips. `parseHTML`/`renderHTML` round-trip `data-kind`/`data-ref-id`/`data-label` so `getJSON()` is the source of truth (we persist JSON, not HTML). Provide an `insertMention` command helper.

  Key reference (TipTap v3, from Context7):
  ```ts
  import { Node, mergeAttributes } from "@tiptap/core";
  import { ReactNodeViewRenderer } from "@tiptap/react";
  // addAttributes(): kind/refId/label with defaults + parseHTML/renderHTML per attr
  // addNodeView(): ReactNodeViewRenderer(MentionChip)
  ```

- [ ] **Step 2 (controller):** `bun run typecheck` + `npx eslint` the file.

### Task 11b: The `/` slash menu (Suggestion)

**Files:**
- Create: `src/components/agent/procedure-editor/slash-menu.ts` (the `Suggestion` plugin config)
- Create: `src/components/agent/procedure-editor/slash-menu-list.tsx` (the React popup list, grouped by category)

- [ ] **Step 1:** Configure `@tiptap/suggestion` with `char: "/"`. `items({ query })` filters a passed-in `MentionSource[]` (from `getMentionSourcesAction`) by label, grouped Knowledge / Integrations / Module / Time, plus trailing actions **"+ Buat tool baru"** and **"+ Buat KB baru"** (the screenshot's "Create new Data Connector"). On select, run the `insertMention` command with the chosen source's `{kind, refId, label}`; the "Buat …" actions instead emit a callback the page handles (open the Tools/KB creation flow, e.g. link to `/app/agent/tools`).
- [ ] **Step 2:** Render the popup with the existing UI kit (match `agent-tools-client.tsx` styling — Radix/shadcn primitives already in the repo); keyboard up/down/enter handled via the Suggestion `onKeyDown`. Follow the v3 `render()` lifecycle (`onStart/onUpdate/onKeyDown/onExit`) from Context7's Suggestion example.
- [ ] **Step 3 (controller):** typecheck + eslint.

### Task 11c: Editor + read-only render components

**Files:**
- Create: `src/components/agent/procedure-editor/procedure-editor.tsx` (controlled: `value: ProcedureContent`, `onChange`, `sources: MentionSource[]`)
- Create: `src/components/agent/procedure-editor/procedure-readonly.tsx` (uses `@tiptap/static-renderer`'s `renderToReactElement` with the same extension set + a `nodeMapping` for `mention` → chip)

- [ ] **Step 1:** `procedure-editor.tsx` — `useEditor({ extensions: [StarterKit, Mention, SlashMenu], content: value, onUpdate: ({editor}) => onChange(editor.getJSON()) })`. Disable StarterKit marks not needed (keep `orderedList`/`bulletList`/`paragraph`/`history`; the screenshot is numbered steps, so ordered list is the default block). Render a thin `<EditorContent>` with the "When to use this procedure" textarea **above** it (the textarea is a sibling controlled field, NOT part of the doc — it maps to `whenToUse`).
- [ ] **Step 2:** `procedure-readonly.tsx` — render `content` via `renderToReactElement({ extensions:[StarterKit, Mention], content, options:{ nodeMapping:{ mention: ChipView } } })`. Used in the list/preview and anywhere a non-editable view is needed.
- [ ] **Step 3 (controller):** typecheck + eslint + `bun test` (full suite, ensure nothing regressed).
- [ ] **Step 4 (controller): Commit** — `feat(agent): TipTap procedure editor with /-mention menu`.

> **Chunk 5 review gate.**

---

## Chunk 6: Procedures page + sub-nav enable

### Task 12: Procedures route + client

**Files:**
- Create: `src/app/app/agent/procedures/page.tsx` (server: `listProceduresAction()` + `getMentionSourcesAction()`)
- Create: `src/components/agent/procedures-client.tsx` (list + create/edit panel using the editor)
- Modify: `src/components/agent/agent-sub-nav.tsx` (drop `soon: true` from the Procedures item)

- [ ] **Step 1:** `procedures/page.tsx` — server component; the layout already enforces admin. Load procedures + mention sources, render `<ProceduresClient procedures={...} sources={...} />`.
- [ ] **Step 2:** `procedures-client.tsx` — left: list of procedures (title, enabled toggle via `updateProcedureAction`, drag/order optional → keep simple: an `order` number input or up/down, YAGNI on drag for v1). Right/drawer: editor panel with Title input, "When to use this procedure" textarea, the `<ProcedureEditor>`, and Save (`createProcedureAction`/`updateProcedureAction` with `{title, whenToUse, content}`), Delete, and an Enabled toggle. Mirror form/toast patterns from `agent-tools-client.tsx`. The "+ Buat tool baru" / "+ Buat KB baru" slash actions navigate to `/app/agent/tools` / KB creation.
- [ ] **Step 3:** Enable the Procedures tab in `agent-sub-nav.tsx`:

```typescript
  { href: "/app/agent/procedures", label: "Prosedur" },
```

- [ ] **Step 4 (controller):** `bun run typecheck` + `npx eslint src/components/agent/* src/app/app/agent/procedures/page.tsx`. Manual: visit `/app/agent/procedures`, create a procedure, type `/`, insert a tool + KB + module mention, save, reload, confirm it persists and the read-only render shows chips.
- [ ] **Step 5 (controller): Commit** — `feat(agent): procedures page + enable Prosedur tab`.

> **Chunk 6 review gate.**

---

## Chunk 7 (optional): Activity / audit

Only if the user wants it now; otherwise defer.

### Task 13 (optional): Persist procedure runs

**Files:** Modify `src/db/schema/triage.ts` (add nullable `procedure_id uuid`, `procedure_title text` to `triage_events`) + migration `0015` + journal; populate them in the `triage.service.ts` `completed` insert; surface at `/app/agent/activity`.

- [ ] Decompose only if greenlit. Keeps Phase 2 core schema-free until then.

---

## Phase 2 acceptance

- [ ] `bun run typecheck` clean; `bun test` green for all new `*.test.ts` (procedure-content, agent-procedures, procedure-selection, procedure-execution, procedure-runtime).
- [ ] `npx eslint` clean on all new files (the one pre-existing copilot-panel error excepted).
- [ ] Migration `0014_agent_procedures.sql` + journal entry present; user can `bun drizzle-kit push` to create the table (answer **create**, not rename, if asked).
- [ ] Admin sees an enabled **Prosedur** tab; can create a procedure with a Title, "When to use" text, and numbered steps containing `/`-inserted **tool**, **KB**, **module**, and **time** mentions; it persists as JSON and re-renders with chips.
- [ ] A ticket matching a procedure's `when_to_use` uses the **procedure-generated reply** (verified via thread / `triage_events`); a non-matching ticket falls back to today's KB suggestion unchanged.
- [ ] A procedure run with a **failed tool call** is forced to **draft-only** (no auto-send); existing schedule/confidence/channel gates still apply on top.
- [ ] Nothing in the pre-procedure triage path regressed (existing Phase 1 tests still pass).

---

## Review loop (per chunk)

After each chunk: dispatch a `plan-document-reviewer` (or `general-purpose`, read-only) subagent with **only** the chunk content + this plan's design references + the design doc path (`docs/plans/2026-06-18-ai-agent-expansion-design.md`) — never session history. Fold fixes in; re-review until ✅. If a loop exceeds 5 iterations, surface to the user.

## Open items to confirm with the user before/during execution

1. **Did Phase 1's `bun drizzle-kit push` complete?** (`agent_tools`/`agent_credentials` + `ai_configs` behavior cols must exist — Task 4/runtime depend on them.)
2. **`ai` v6 `generateText` step shape** — confirm `result.steps[].toolCalls/toolResults` + `stopWhen: stepCountIs(n)` (adjust Task 7 accumulation if v6 differs; tests stay the seam).
3. **Activity/audit (Chunk 7)** — build now or defer? Default: defer (keeps Phase 2 schema-free beyond the one table).
4. **Procedure ordering UX** — number input / up-down for v1 (drag-and-drop deferred). Confirm acceptable.
