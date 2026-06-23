# Exhibition Live Dashboard — Plan & Context

> **Status:** Planning (approved direction, not yet implemented)
> **Owner:** Emir
> **Goal:** A big-screen "live wall" for an exhibition that visualises every AI
> interaction in SalamDesk in real time — triage, classification, KB retrieval,
> tool calling, procedures, auto-reply decisions — plus a QR code so visitors can
> chat the bot and watch their own message flow through the wall.

This doc is self-contained so any agent (or a fresh session) can resume without
re-exploring the codebase. It captures: the relevant existing architecture, the
events we want to surface, the dashboard design, the phased implementation plan,
and the decisions already made.

---

## 0. Decisions locked in

| Question | Decision |
| --- | --- |
| Data source for the dashboard | **New rich SSE channel** (`dashboard-events`) + `/api/exhibit/stream`, with fire-and-forget publishes instrumented into the pipeline. Do NOT overload the existing `ticket-events` channel. |
| Visitor interactivity | **Live wall + QR self-try** — on-screen QR opens WhatsApp to the demo number; visitors chat and watch their message flow through the wall. |
| New dependencies | **None.** Everything needed is already installed (`motion`, `recharts`, `radix-ui`/`shadcn`, `swr`, `sonner`, `qrcode.react`, `next-themes`, Tailwind 4). |
| Current step | Plan only — implementation starts with Phase 1 when given the go. |

---

## 1. System context (how SalamDesk works today)

SalamDesk is an AI-powered **WhatsApp helpdesk for hospital IT support (SIMRS)**,
all prompts in Indonesian. Two processes share one Postgres + one Redis:

- **Next.js app** (Vercel) — UI, REST API, server actions, BullMQ job producer.
- **Standalone worker** (VPS/Docker) — holds the Baileys WhatsApp socket and runs
  all BullMQ workers. Boots in `src/worker/index.ts`.

Postgres (Drizzle ORM) is the single source of truth. Redis is the BullMQ broker
**and** the pub/sub bus for realtime UI. Langfuse traces every LLM call.

### Message flow
```
WhatsApp msg → Baileys socket → [wa-inbound] → bot.ts
   → find/create requester + ticket → [ai-triage] → triageTicket()
   → (policy gate passes?) → send now [wa-outbound]
                           OR delayed [ai-auto-reply]
                           OR draft for staff
```

### The triage pipeline — `src/services/triage.service.ts` `triageTicket()` (the brain)
Runs, in order:
1. **Vision pre-pass** — if an image arrives with <15 chars text, `describeImages()`
   (`triage-ai.service.ts`) captions it so text-only classifiers can read it.
2. **3 parallel LLM classifiers** (`Promise.all`):
   - `classifyModule()` → SIMRS module + confidence (0–1) + reasoning
   - `classifyPriority()` → low/medium/critical + reasoning
   - `classifyOnTopic()` → **off-topic guard** (blocks chit-chat/spam)
3. **KB retrieval** — `searchKnowledgeBase()` (`knowledge.service.ts`): hybrid
   **75% Voyage `voyage-4` vector + 25% keyword** over pgvector; top 3.
   Then `evaluateKbMatch()` decides relevance + drafts a grounded reply.
4. **Procedures** — `tryProcedure()` (`procedure-runtime.service.ts`): an LLM
   `pickProcedure()` selects one, `runProcedure()` (`procedure-execution.service.ts`)
   executes steps with **tool calls** (HTTP / Exa, max 5 steps). If any tool fails →
   forced `draft-only`.
5. **AI-first fallback** — if nothing matched and `aiFirstMode=on`,
   `generateClarifyingReply()` sends a warm 1–3 sentence reply + one question.
6. **Policy gate** — `canAutoReply()` (`auto-reply-policy.service.ts`): **9 sequential
   gates** (enabled, channel, per-ticket cap, reply exists, KB grounding, confidence
   ≥ threshold, critical-skip, blocked keywords, business hours).
7. Writes a full **`triage_events`** audit row + emits realtime `triage:completed`.

**AI-first "bypass":** an AI-first reply (`isAiFirstReply=true`) bypasses the
stricter gates (KB-grounding, confidence, per-ticket cap, critical-skip) because
asking a clarifying question is always safe. Still respects: enabled, business
hours, blocked keywords. (Recent commits: `191bdd7`, `90a50c5`, `d688043`, `8f72a9c`.)

### Models / config
- LLM: `google/gemini-2.5-flash` via OpenRouter (`src/lib/ai.ts`).
- Embeddings: Voyage `voyage-4` (1024-dim, pgvector HNSW).
- All behaviour driven by a singleton `ai_configs` row (`src/db/schema/ai-config.ts`):
  switches, thresholds, blocked keywords, persona/tone/signature/guardrails,
  business hours, delay. Editable in Settings, no redeploy.

### BullMQ queues (`src/lib/queue.ts`, booted in `src/worker/index.ts`)
`wa-inbound` (5), `wa-outbound` (3), `ai-triage` (3), `ai-auto-reply`,
`ticket-lifecycle` (recurring: auto-close 15m, SLA scan 5m), `knowledge-ingestion`.

### Key DB tables
- `tickets` — note `module_set_by: user|ai|system` (AI never overrides a human's
  module choice), `module_confidence`, `priority`, `status`, SLA fields.
- `ticket_messages` — `sender_type: requester|staff|ai_agent|system`.
- `triage_events` — immutable audit log of every triage run (module, priority, KB,
  reply confidence, auto_reply_allowed/sent, blocked_reason, model, error).
- `knowledge_documents` / `knowledge_chunks` (embeddings).
- `modules`, `requesters` / `requester_identities`, `ai_configs`.

### Existing realtime infra (THE BACKBONE WE EXTEND)
- `src/lib/realtime.ts` — `TICKET_EVENTS_CHANNEL = "ticket-events"`,
  `TicketRealtimeEvent` union (thin: `ticket:created/updated`, `triage:started/completed`,
  `message:received`), `publishTicketEvent()` (fire-and-forget, log-and-swallow).
- `src/app/api/tickets/stream/route.ts` — SSE route. Node runtime, `force-dynamic`.
  Opens a **dedicated `ioredis` subscriber per connection** (a subscriber connection
  is locked into subscribe mode), forwards each pub/sub message as an SSE `data:`
  frame, sends `: ping` heartbeat every 25s, cleans up on `request.signal` abort.
  Sets `X-Accel-Buffering: no` so nginx flushes frames immediately.
- `src/components/tickets/ticket-events-context.tsx` — client `EventSource` that
  revalidates SWR caches on events. **The exhibit will use a similar EventSource but
  push into a ring buffer instead of revalidating SWR.**

> Producers of `publishTicketEvent` today: `src/worker/{bot,triage.worker,auto-reply.worker}.ts`,
> `src/services/{triage,ticket-lifecycle}.service.ts`. Copy that call-site pattern
> for the new dashboard publishes.

---

## 2. What to show on the dashboard (full event catalog)

These all already exist as decision points internally; we just broadcast them live.

**Conversation / intake**
- New inbound WhatsApp message (requester name, preview, channel)
- Requester resolved vs. newly created (**first-time chatter** highlight)
- Ticket created / reopened / appended
- Image received → re-hosted to UploadThing
- Vision pre-pass: caption generated (show the Indonesian caption)

**Triage / classification (showpiece)**
- Triage started ("menganalisis…")
- Module result: module + confidence% + reasoning
- Priority result: level + reasoning
- Off-topic guard: on-topic? (esp. when it blocks — good demo moment)

**Knowledge base / RAG**
- KB search fired: query terms, #chunks scanned
- Top matches with similarity scores (the hybrid 75/25 score)
- KB grounding eval: relevant? confidence? which article used
- KB ingestion: upload → chunking → embedding batches → ready

**Procedures / tool calling (wow moment)**
- Procedure router picked a procedure + confidence
- Each step executing
- Each tool invoked — HTTP (endpoint) or Exa (query) — + result/ok/fail
- Guardrail trip: tool failed → forced draft-only

**AI-first / decision**
- AI-first clarifying reply generated
- **Bypass indicators** (KB-grounding / confidence / critical bypassed)
- `canAutoReply` verdict — which of the 9 gates passed/failed + blocked reason
- Final action: sent immediately / queued delayed / held as draft
- Off-hours courtesy message sent

**Outbound / lifecycle**
- Typing presence → human-like delay → message sent
- SLA transitions (safe→warning→breached)
- Auto-close of resolved tickets

**Aggregate metrics (chart panels)**
- tickets/min, avg triage latency, auto-reply rate, KB hit rate, top modules,
  priority distribution, off-topic blocks, (optional) token usage/cost from Langfuse.

---

## 3. Dashboard design

**Kiosk/TV-mode route, separate from the operator app.** Glanceable across a room.
Dark theme, big type, brand accent for "live" pulses, generous motion.

### Page `/exhibit` — the hero wall (3 columns)
```
┌──────────────────────────────────────────────────────────────────────┐
│  SALAMDESK · LIVE     ● 3 tickets/min   ● 94% auto-resolved     12:04  │
├──────────────┬───────────────────────────────┬───────────────────────┤
│ LIVE FEED    │   AGENT PIPELINE (center)     │   STATS                │
│ newest top   │  card per active ticket:      │  • tickets/min (line)  │
│ color-coded  │   ① Vision ✓ caption          │  • modules (donut)     │
│ by type      │   ② Module: Billing 0.91      │  • auto-reply rate     │
│ animates in  │   ③ Priority: critical        │  • KB hit rate (radial)│
│              │   ④ KB: "Reset SEP" 0.88      │  • off-topic blocked   │
│              │   ⑤ Tool: GET /sep → 200      │  • top modules today   │
│              │   ⑥ Gate: ✓ sent              │                        │
│              │  (slides out when done)        │  + QR self-try corner  │
└──────────────┴───────────────────────────────┴───────────────────────┘
```
- **Left — Live Event Feed:** vertical ticker, newest prepends, color-coded, each row animates in.
- **Center — Pipeline Theater:** active ticket cards where each stage lights up as
  its event arrives; confidence bars fill; tool calls expand inline; card slides out when done.
- **Right — Stats:** live recharts panels + counters.
- **QR corner:** `qrcode.react` encoding `https://wa.me/<demo-number>?text=<prefilled>`.

### Optional pages
- `/exhibit/inspect/[ticketId]` — replay/drill-down of one ticket's full reasoning
  (reads `triage_events` + messages) for booth staff to explain a moment.

---

## 4. Implementation plan (phased)

### Phase 1 — Backend event spine
1. **`src/lib/dashboard-events.ts`** (new) — mirror `realtime.ts`:
   - `DASHBOARD_EVENTS_CHANNEL = "dashboard-events"`.
   - `DashboardEvent` discriminated union. Each variant carries `id`, `ticketId`,
     `ts`, a human-readable `label`, plus its own detail fields. Variants:
     `ticket.new`, `requester.firsttime`, `vision.captioned`, `classify.module`,
     `classify.priority`, `guard.offtopic`, `kb.searched`, `kb.matched`,
     `procedure.picked`, `tool.invoked`, `tool.result`, `gate.decision`
     (incl. `bypasses[]`), `reply.sent` (`mode: immediate|delayed|draft`),
     `ingestion.progress`, `sla.changed`, `ticket.autoclosed`.
   - `publishDashboardEvent()` — fire-and-forget, log-and-swallow.
2. **`src/app/api/exhibit/stream/route.ts`** (new) — copy `tickets/stream/route.ts`,
   swap the channel to `DASHBOARD_EVENTS_CHANNEL`, and **remove the `getSession()`
   check** (kiosk runs logged-out) OR gate behind a static `EXHIBIT_TOKEN` query param.
   Keep the dedicated-subscriber + heartbeat + abort-cleanup pattern intact.

### Phase 2 — Instrument the pipeline (additive publishes, no logic change)
3. `src/services/triage.service.ts` — publish at each decision point: vision caption,
   3 classifier results, KB search + match, gate verdict (+ bypass flags), final action.
4. `src/services/procedure-execution.service.ts` — publish per tool invocation + result,
   and the guardrail trip.
5. `src/services/triage-ai.service.ts` / `src/worker/knowledge-ingestion.worker.ts` —
   vision caption + ingestion progress.
6. `src/worker/bot.ts` — "new ticket" + "first-time requester" on intake.

> All additive and fire-and-forget; if Redis hiccups, triage is unaffected. We
> already write all of this to `triage_events` — we're just ALSO streaming it.

### Phase 3 — Frontend wall (`/exhibit`)
7. **Route group `src/app/exhibit/`** — standalone dark kiosk layout, OUTSIDE the
   authed `(app)` group.
8. **`exhibit-stream-context.tsx`** — `EventSource('/api/exhibit/stream')`; push events
   into a **bounded ring buffer (~100 items)** in state; derive per-ticket pipeline
   state + rolling metric windows. No SWR/polling — the stream IS the data.
9. **`<LiveFeed>`** — `motion` `AnimatePresence` + `layout`, **stable `key={event.id}`**
   (never array index), prepend newest, fade-out on eviction.
10. **`<PipelineTheater>`** — active ticket cards; stages light up as events arrive;
    `motion` width-animated confidence bars; expandable tool calls.
11. **`<StatsPanel>`** — `recharts` `ResponsiveContainer` + `LineChart`/`PieChart`/
    `RadialBarChart`. **`isAnimationActive={false}`** on all series (avoids stutter on append).

### Phase 4 — QR self-try
12. **`<QrCorner>`** — `qrcode.react` → `https://wa.me/<demo-number>?text=<prefilled>`.
13. Optional: badge the visitor's own ticket card ("👋 booth visitor") via a marker
    in the prefilled text or a fresh-requester check.

---

## 5. Library guidance (from Context7, current docs)

- **motion** (`/websites/motion_dev`): live feed = `AnimatePresence` wrapping the list
  with `layout` on each item; **immediate children MUST have a unique stable `key`**
  (item id, NOT index — index breaks exit/reorder animations). `initial`/`animate`/`exit`
  for enter/leave; `layout` makes surviving rows slide smoothly.
- **recharts** (`/recharts/recharts`, v3.x — repo has 3.8): use `ResponsiveContainer`.
  **For streaming data set `isAnimationActive={false}`** — each data change generates a
  new animation id and re-triggers the full ~1500ms animation, causing stutter. Keep a
  rolling window of N points in state and append per metric event.
- **SSE over WebSockets:** already working, one-directional (server→screen), auto-reconnects,
  survives nginx via `X-Accel-Buffering: no`. No WS server needed.

---

## 6. Risks / open items

- **SSE connection count:** one wall screen is fine; each connection opens a dedicated
  `ioredis` subscriber. If mirroring to several screens, cap it or share one screen.
- **Public demo WhatsApp line:** needs a number safe to expose at the event (rate limits,
  spam). Decide early.
- **Empty-wall problem:** pre-seed traffic with `bun run db:seed-tickets` so the wall is
  never empty in quiet moments. Consider a "demo mode" that replays seeded events.
- **Auth on the kiosk:** confirm whether to drop auth entirely or use `EXHIBIT_TOKEN`.

---

## 7. File change checklist

New:
- [x] `src/lib/dashboard-events.ts` — **done (Phase 1)**
- [x] `src/app/api/exhibit/stream/route.ts` — **done (Phase 1)**
- [ ] `src/app/exhibit/layout.tsx` + `src/app/exhibit/page.tsx`
- [ ] `src/app/exhibit/exhibit-stream-context.tsx`
- [ ] `src/components/exhibit/{live-feed,pipeline-theater,stats-panel,qr-corner}.tsx`

Edit (additive publishes only):
- [ ] `src/services/triage.service.ts`
- [ ] `src/services/procedure-execution.service.ts`
- [ ] `src/services/triage-ai.service.ts`
- [ ] `src/worker/knowledge-ingestion.worker.ts`
- [ ] `src/worker/bot.ts`

Env:
- [ ] `EXHIBIT_TOKEN` (optional kiosk gate), demo WhatsApp number for QR.
</content>
</invoke>
