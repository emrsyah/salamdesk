# AI Agent Expansion — Design

Date: 2026-06-18
Status: Approved (design); implementation pending

## Goal

Expand the SalamDesk AI agent from a threshold-driven triage/auto-reply pipeline
into a configurable agent with three new pillars — **tools/integrations**,
**procedures** (rich-text playbooks), and **behavior/voice** — plus
schedule-aware auto-reply control. There is a single global agent.

## Background — what exists today

The `ai_configs` singleton table already **is** the agent's policy. It holds:
`aiTriageEnabled`, `autoClassifyModule`, `moduleConfidenceThreshold`,
`autoSetPriority`, `autoReplyEnabled`, `replyConfidenceThreshold`,
`autoReplyDelayMinutes`, `autoReplyChannels`, `skipCriticalPriority`,
`requireKbGrounding`, `blockedKeywords`, `maxAutoRepliesPerTicket`.

Runtime flow (`triage.service.ts`): triage → classify module/priority →
KB search (`searchKnowledgeBase`) → evaluate top KB match → auto-reply policy
gates (`auto-reply-policy.service.ts`) → send now / hold with delay
(`auto-reply.worker.ts`) / draft.

Today the AI config is edited in a modal tab ("Perilaku AI") inside
`settings-dialog.tsx`. There is **no** concept of tools, integrations,
procedures, playbooks, rules-engine, or business-hours scheduling.

## Decisions

- **One global agent.** The `ai_configs` singleton is the agent. New tables
  (`agent_tools`, `agent_procedures`) belong to it implicitly — no `agent_id`
  column yet (easy to add later for multi-agent).
- **Procedure selection = AI semantic match** on a `when_to_use` description
  (Intercom-Fin style). No separate routing/rules engine.
- **Rules = global gates only.** Confidence, business hours, channel,
  skip-critical, KB-grounding, blocked keywords. They control *when* the agent
  may auto-act; procedures control *what* it does once engaged.
- **Procedures are additive.** If no procedure matches, fall back to today's
  KB-grounded suggestion. Nothing breaks.
- **Tool credentials: encrypted in DB.** App-level encryption with a key from
  env, so admins can add integrations from the UI without a redeploy.
- **Editor is phased.** The rich-text `/Use` procedure editor is Phase 2.

## Information architecture

New top-level **"AI Agent"** sidebar section (`LAINNYA` group, admin-only),
replacing the "Perilaku AI" modal tab. Real routes, not a modal:

```
/app/agent              → Behavior     (name, persona, tone, language, signature, guardrails)
/app/agent/tools        → Tools        (custom API calls + Exa web search)
/app/agent/procedures   → Procedures   (list + rich-text /Use editor)   [Phase 2]
/app/agent/automation   → Automation   (gates + schedule)
/app/agent/activity     → Activity     (audit of what the agent did & why) [optional, later]
```

The existing "Perilaku AI" settings tab is migrated into **Behavior** +
**Automation**. The settings dialog keeps Modules + SLA.

## Data model

### Extend `ai_configs` (the agent)

Behavior:
- `agent_name` text
- `persona` text (base system prompt / role)
- `tone` text
- `language` text default `'id'`
- `reply_signature` text
- `guardrails` text (extra do/don'ts)

Schedule:
- `business_hours` jsonb — `{ timezone, windows: [{ days, start, end, mode }] }`
  where `mode` ∈ `auto | draft-only`. Outside any window → a configurable
  default mode.

(All existing gate columns are retained unchanged.)

### `agent_tools` (reusable connectors)

- `id` uuid pk
- `name` text
- `description` text — **what the LLM reads to decide when to call it**
- `type` text — `http | exa_search`
- `config` jsonb
  - http: `{ method, urlTemplate, headers, inputSchema, bodyTemplate, responseMapping }`
  - exa_search: `{ numResults, ... }`
- `credential_id` uuid null → `agent_credentials`
- `enabled` boolean default true
- timestamps

### `agent_credentials` (encrypted secrets)

- `id` uuid pk
- `name` text
- `kind` text — `bearer | api_key_header | basic | custom`
- `secret_encrypted` text (app-level encryption; key from `AGENT_SECRET_KEY` env)
- timestamps

### `agent_procedures` (Phase 2)

- `id` uuid pk
- `title` text
- `when_to_use` text — the semantic matcher
- `content` jsonb — ProseMirror/TipTap doc with custom inline nodes
  `tool-mention` (refs `agent_tools.id`) and `kb-mention` (refs KB doc/module)
- `enabled` boolean
- `order` integer
- timestamps

## Runtime flow changes

Inserted after KB search in `triage.service.ts`:

1. **Procedure selection** — if enabled procedures exist, an LLM call (or
   embedding match) compares the ticket to each procedure's `when_to_use` and
   picks the best match (or none).
2. **Procedure execution** — when matched, run an AI SDK (`ai` v6) tool-calling
   loop: the model follows the procedure steps, may call `/Use` tools
   (HTTP/Exa) through a tool-executor service, grounds in mentioned KBs, and
   emits a reply plus an optional action (`escalate | draft-only | send`).
3. **Fallback** — no match → existing KB-grounded suggestion path.
4. **Automation gates** — existing policy plus business-hours: the schedule can
   force draft-only outside hours or enable after-hours autopilot.

### Tool executor service (new)

- Builds AI SDK `tool` definitions dynamically from `agent_tools` rows
  (`inputSchema` → zod).
- HTTP tool: interpolate URL/body/headers from model-supplied args + decrypted
  credential, fetch, map response back to the model.
- Exa tool: call Exa search API with the query.
- Guardrails: timeout, allowlist/denylist of hosts, max calls per ticket,
  redact secrets from logs.

## Error handling

- Tool call failure → return a structured error to the model so it can recover
  or fall back; never auto-send a reply built on a failed required tool.
- Procedure execution failure → fall back to KB-grounded suggestion, log to
  triage events with reason.
- Missing/invalid credential → tool disabled with a clear admin-facing error.
- Encryption key absent → tools requiring secrets are disabled, surfaced in UI.

## Testing

- Unit: tool-executor (URL/body interpolation, response mapping, credential
  decryption, host allowlist), business-hours window evaluation, procedure
  selection ranking.
- Integration: triage with a matching procedure that calls a mock HTTP tool;
  triage with no match (fallback); auto-reply gate honoring schedule.
- Manual: Tools page "Test" runner; Exa wired into copilot panel.

## Phasing

### Phase 1 — extends existing config (low risk)
- "AI Agent" sidebar section + routing.
- **Behavior** page (new `ai_configs` columns).
- **Automation** page (migrate existing gates out of the modal; add
  business-hours schedule + enforce it in the auto-reply policy/worker).
- **Tools** page: `agent_tools` + `agent_credentials` CRUD, encryption, a
  "Test" runner, and the tool-executor service.
- Quick win: wire **Exa search into the copilot panel** to exercise tools
  before automation depends on them.

### Phase 2 — the novel piece
- **Procedures** list + rich-text `/Use` editor (tool & KB mention nodes).
- Procedure selection + execution wired into triage via the AI SDK
  tool-calling loop.

## Out of scope (YAGNI for now)

- Multi-agent / per-module agents.
- React-flow visual builder (procedures are rich text, not node graphs).
- Deterministic scenario→procedure routing rules (AI semantic match instead).
- Voice (audio) — "voice" here means written persona/tone, not TTS/STT.
