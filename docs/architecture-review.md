# SalamDesk — Architectural Review & Deepening Opportunities

**Date**: 2026-05-06  
**Scope**: Full codebase architecture review  
**Method**: Deletion test, seam analysis, interface-depth assessment

---

## Codebase State: **Transitional**

The codebase is well-structured for a young project but exhibits classic early-stage friction: shallow service wrappers, inconsistent layering, a growing god module, and scattered cross-cutting concerns. Patterns are emerging but not yet enforced. This is the ideal moment to deepen — before more code accretes on shallow foundations.

---

## 1. Shallow Service Wrappers (CRUD Pass-Through)

### Files

`src/services/message.service.ts`, `src/services/module.service.ts`, `src/services/quick-reply.service.ts`, `src/services/user.service.ts`, `src/services/knowledge.service.ts`

### Problem

Most services are **shallow** — their interface is nearly as complex as their implementation. They exist as pass-through layers that add an `import` hop without increasing **leverage** for callers.

**Deletion test on `message.service.ts`**: Delete it and inline the 2 Drizzle queries into the 1 caller (`messages.actions.ts`). Complexity doesn't increase — the module was a pass-through.

The service layer _does_ become valuable where business logic lives (`ticket.service.ts` has SLA computation, role-based filtering, multi-step creation) and the AI orchestration in `ai.service.ts`. But the CRUD-only services have interfaces identical to Drizzle's query API — no depth gained.

### Solution

Merge CRUD-only services back into their callers (or a shared data-access module) and reserve `src/services/` for modules with genuine **depth**: business logic, orchestration, cross-cutting rules. The **interface is the test surface** — if a service's test would be identical to a Drizzle integration test, it's not earning its keep.

### Benefits

- **Locality**: Ticket logic lives where it's called, not behind an unnecessary file boundary
- **Leverage**: Developers navigate fewer files to understand a single operation
- **Tests**: Less mocking — test the real query paths directly

---

## 2. AI Service — God Module with 5 Responsibilities

### Files

`src/services/ai.service.ts` (321 lines)

### Problem

`ai.service.ts` is the most **coupled** module in the codebase. A single function, `triageTicket()`, does:

1. Module classification (AI call)
2. Priority re-assessment (AI call)
3. KB article matching (AI call)
4. Persisting results across 2 DB tables (3 write operations)
5. Sending WhatsApp auto-replies

This module **imports and orchestrates 3 other services** (`module.service`, `knowledge.service`, `whatsapp.service`) while also writing directly to `tickets` and `aiSuggestions` tables.

**Deletion test**: Delete `triageTicket()`. The module classification, priority logic, KB matching, and auto-reply decisions all vanish from one file — but they'd need to reappear across multiple worker/action files. That means the module _earns its keep_ — but it's **too shallow in interface** for its implementation complexity. It has one entry point and 5 side effects.

### Solution

Split into three deepened modules:

1. **Triage Classifier** — pure AI classification (module + priority). Input: ticket text. Output: classification result. No DB writes.
2. **KB Matcher** — KB search + relevance evaluation. Input: ticket text + KB articles. Output: match result.
3. **Auto-Reply Engine** — decides whether to auto-reply. Input: triage result + match result + threshold. Output: reply text (or null).

The **orchestration** (sequencing these + writing to DB) moves to the worker handler or a dedicated triage orchestrator.

### Benefits

- **Locality**: Each classifier can be tested independently with mock AI responses
- **Leverage**: The KB matcher becomes reusable outside triage (e.g., an agent searches KB from the UI)
- **Tests**: Each module can be unit-tested without needing DB or WhatsApp connections

---

## 3. Inconsistent Service-Action Layering

### Files

`src/actions/modules.actions.ts`, `src/actions/users.actions.ts`, `src/actions/ai-suggestions.actions.ts` vs `src/actions/tickets.actions.ts`, `src/actions/messages.actions.ts`

### Problem

Some actions go through services (`tickets.actions.ts` → `ticket.service.ts`), while others bypass the service layer entirely and hit `db` directly (`modules.actions.ts` writes to `db.insert(modules)` inline).

Worse, `tickets.actions.ts` uses **dynamic imports** (`await import("@/services/ticket.service")`) inside each action function — this is an anti-pattern that defeats tree-shaking and adds async overhead for no benefit.

`messages.actions.ts` calls **3 different services** for a single `sendReplyAction()` — this is a tell that the action became an orchestrator, not a thin boundary.

### Solution

Standardize on one pattern:

- **Actions** = auth gate + input validation + single service call + revalidation
- **Services** = all business logic + DB access

Move the inline DB calls in `modules.actions.ts` and `users.actions.ts` into their respective services. Convert dynamic imports to static top-level imports. Extract the orchestration in `messages.actions.ts` into a `sendReply()` function in `ticket.service.ts` or a new `message-orchestrator.service.ts`.

### Benefits

- **Locality**: One pattern to learn, not three. New contributors don't guess which layer to put DB access in
- **Leverage**: Services become the single seam for DB access — change the DB in one place
- **Tests**: Actions become trivially testable (mock the service), services test real DB

---

## 4. Auth Schema Split at the Seam

### Files

`auth-schema.ts` (project root), `src/db/schema/index.ts`, `src/db/schema/users.ts`

### Problem

Better-Auth's user/session/account/verification tables live in `auth-schema.ts` at the project root. The application `users` table is exported from `src/db/schema/users.ts` — but it **re-exports the same `user` table from auth-schema** with an alias (`users`). Relations are defined in `auth-schema.ts` (user ↔ tickets, user ↔ messages, etc.), but the app schema is in `src/db/schema/`.

This means:

- `auth-schema.ts` imports from `src/db/schema/tickets.ts` and `src/db/schema/modules.ts` — the root-level file depends on deep src files
- `src/db/schema/index.ts` re-exports from `../../../auth-schema` — a fragile relative path
- `whatsapp.service.ts` imports `user` from `auth-schema` directly, bypassing the `src/db/schema` barrel

The **seam** between auth and application schemas is poorly placed — relations cross the boundary in both directions.

### Solution

Move `auth-schema.ts` into `src/db/schema/auth.ts`. Define app-specific relations (user ↔ tickets) in the app schema files, not in auth-schema. The auth schema should not know about tickets, messages, or modules. Use Drizzle's relation definitions in the _consuming_ schema files.

### Benefits

- **Locality**: Auth schema becomes a standalone module with no app knowledge — pluggable, testable
- **Leverage**: Swapping auth providers (Better-Auth → Clerk, etc.) touches one directory
- **Tests**: Auth can be integration-tested without spinning up the full app schema

---

## 5. Middleware HTTP-to-Self Auth Check

### Files

`src/middleware.ts`

### Problem

The middleware authenticates `/app/*` routes by making an HTTP fetch to `/api/auth/get-session` on the same server:

```ts
const sessionRes = await fetch(new URL("/api/auth/get-session", request.url), {
  headers: request.headers,
});
```

This is a round-trip through the HTTP stack for what should be a direct function call. It adds latency to every single page navigation. Better-Auth's `auth.api.getSession()` is already callable server-side — it's used that way in every action file.

### Solution

Call `auth.api.getSession({ headers })` directly in the middleware, or use Better-Auth's built-in middleware helper (`better-auth/middleware`). No HTTP fetch needed. This is a **real seam** — one adapter (direct call) replaces another (HTTP fetch) with no interface change for the rest of the app.

### Benefits

- **Performance**: Eliminates a full HTTP round-trip per page request
- **Locality**: Auth logic is one function call, not a distributed request
- **Leverage**: Middleware becomes simpler to test and understand

---

## 6. WhatsApp Bot — Decision Tree Not Decomposed

### Files

`src/worker/bot.ts` (73 lines)

### Problem

`processInboundWaMessage()` encodes a decision tree inline:

1. Find/create reporter
2. Find open ticket → if exists, append message
3. Else → create ticket + enqueue AI triage

This is all in one function with no deeper modules behind it. The **interface** (one function, one return type) is fine, but the **implementation** couples reporter management, ticket lifecycle decisions, and job enqueueing. If ticket creation rules change (e.g., group similar messages within a time window), the entire function must be edited.

**Deletion test**: Delete the function and the complexity of "is there an open ticket?" spreads to every caller. The function earns its keep. But it could be **deeper** — hide more complexity behind the same interface.

### Solution

Extract two seams:

1. **Ticket Router** — decides "append vs create" based on phone history. Pure function, testable with mock ticket data.
2. **Reporter Registry** — already exists as `findOrCreateReporterByPhone()` in whatsapp.service.ts. Keep it there.

The bot function becomes composition: `router(appender, creator, phone, text)`.

### Benefits

- **Locality**: Ticket routing rules are in one testable module, not buried in bot orchestration
- **Leverage**: The router could be reused for email/web ticket routing if multi-channel expands
- **Tests**: Decision tree can be tested exhaustively without WhatsApp or DB

---

## 7. No Error Handling Strategy

### Files

All `src/actions/*.ts`, `src/services/*.ts`

### Problem

Error handling is inconsistent:

- `tickets.actions.ts` returns `{ error: "..." }` or `{ success: true }`
- `modules.actions.ts` throws `Error("Unauthorized")`
- `messages.actions.ts` throws `Error("Unauthorized")` — let me verify that. Wait, it does throw in the earlier code I saw.
- `ai.service.ts` wraps everything in try/catch and **swallows errors** — returns a partial result, silently failing AI triage
- `ticket.service.ts` has no error handling at all — lets DB errors propagate

Action callers have no standard error shape to depend on. Some actions throw, some return `{ error }`. This is friction for every new UI that calls an action.

### Solution

Define a **Result type** at the seam between actions and callers:

```ts
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
```

All actions return this shape. No action ever throws. The `ai.service.ts` should not silently swallow — it should signal failure so the worker can retry (BullMQ already handles retries, so let it).

### Benefits

- **Leverage**: One type defines the entire action seam — callers (React components) handle errors uniformly
- **Locality**: Error handling logic lives at one seam, not per-action
- **Tests**: Can test error paths by checking `result.success === false`

---

## 8. Knowledge Gap Detection Crosses Service Boundary

### Files

`src/services/knowledge.service.ts` (line 130-159)

### Problem

`getKbGaps()` is in `knowledge.service.ts` but queries the `tickets` table directly. This means the knowledge service **imports from and depends on** the ticket schema. Service boundaries are porous — the knowledge module knows about ticket internals.

### Solution

Either:

- Move `getKbGaps()` to `ticket.service.ts` (it's fundamentally a ticket analytics query)
- Or create an analytics/reporting module at a higher level that joins both domains

### Benefits

- **Locality**: If the tickets table changes, knowledge service doesn't need updating
- **Leverage**: Reporting queries are centralized, not scattered across service files

---

## 9. No Test Infrastructure

### Files

None. Zero test files exist in the entire project.

### Problem

The entire codebase has **zero tests**. All architectural changes currently carry full regression risk. The **interface is the test surface** — but no interfaces are being tested. A deepening effort without tests is architecture on sand.

### Solution

Start with integration tests for the deepest modules first:

1. `ticket.service.ts` — highest business logic density, most callers
2. `ai.service.ts` — after decomposition, test each classifier independently
3. `whatsapp.service.ts` — reporter creation logic has edge cases

Use a test DB (Docker Postgres or Supabase local) with Drizzle's migration runner. Framework: Vitest (Bun-native, fast).

### Benefits

- **Leverage**: Once the core module is tested, refactoring becomes safe
- **Locality**: Bugs found in tests are fixed near the test, not in production

---

## 10. Worker Shares DB Connection Pattern with Main App

### Files

`src/lib/redis.ts`, `src/worker/index.ts`, `src/db/index.ts`

### Problem

The worker creates its **own Redis connection** (`workerRedis` in `src/worker/index.ts`) separate from the shared `redisConnection` in `src/lib/redis.ts`. This is correct for BullMQ (workers need their own Redis clients), but the worker also imports services that use the shared `db` connection from `src/db/index.ts`.

This means the worker has a **split dependency**: some infrastructure it manages itself (Redis workers), some it inherits from the main app (DB connection pool). If the DB connection pattern changes (e.g., read replicas), both the app and worker must be updated.

### Solution

Create a `src/lib/connections.ts` barrel that exports factory functions for both Redis and DB connections. Both the main app and worker use the same factories. The worker explicitly passes its own Redis instance to BullMQ workers, but gets its DB client from the same source as the app. This makes the **seam** explicit — connection creation is one place, connection _usage_ is per-context.

### Benefits

- **Locality**: All connection management in one module
- **Leverage**: Adding a read-replica or connection pool tuning touches one file

---

## Summary

| #   | Issue                                | Severity     | Effort |
| --- | ------------------------------------ | ------------ | ------ |
| 1   | Shallow CRUD service wrappers        | Medium       | Low    |
| 2   | AI service god module                | High         | High   |
| 3   | Inconsistent action-service layering | High         | Medium |
| 4   | Auth schema split location           | Medium       | Medium |
| 5   | Middleware HTTP-to-self              | Low          | Low    |
| 6   | Bot decision tree not decomposed     | Medium       | Low    |
| 7   | No error handling strategy           | High         | Medium |
| 8   | Knowledge gap crosses boundary       | Low          | Low    |
| 9   | No test infrastructure               | **Critical** | High   |
| 10  | Worker connection split              | Low          | Low    |

**Recommended priority**: #9 (tests) → #3 (layering consistency) → #2 (AI decomposition) → #7 (error handling) → #1 (shallow services) → rest.

---

_This review uses the architectural vocabulary from the improve-codebase-architecture skill: module, interface, implementation, depth, seam, adapter, leverage, locality. No CONTEXT.md or ADRs were found — domain terms are derived from the README and schema files._
