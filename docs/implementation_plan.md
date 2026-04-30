# SALAMDesk — Implementation Plan

A helpdesk app for SIMRS users at RSUD Karawang, built in phases from core ticketing to AI-powered automation.

---

## Architecture Decisions

### Routing Pattern: Split-Pane for Tickets, Separate Pages for Knowledge Base

**Tickets** use a split-pane master-detail layout on a single page (`/app/tickets`). The selected ticket is tracked via `?selected={ID}` query param using the `useQueryParams()` hook. This gives instant switching between tickets without page navigation — ideal for a helpdesk workflow.

**Knowledge Base** uses traditional separate pages for CRUD operations: `/app/knowledge/[id]` (view), `/app/knowledge/new` (create), `/app/knowledge/[id]/edit` (edit). Content management benefits from dedicated URLs for deep-linking and sharing.

**Settings** (admin-only: module management, SLA config) uses a modal/dialog triggered from a gear icon in the sidebar header. No separate `/app/settings` route — this is rarely accessed and doesn't warrant a top-level page.

**Quick Replies** gets its own page (`/app/quick-replies`) since agents use it frequently.

### Component Architecture: Tickets

The tickets page is the most complex view in the app. It's decomposed into focused sub-components under `src/components/tickets/`:

```
src/components/tickets/
├── ticket-list.tsx              # Left pane: tabs + search + scrollable list
├── ticket-list-item.tsx         # Single ticket card in the list
├── ticket-detail.tsx            # Right pane: orchestrator for all detail sub-components
├── ticket-detail-header.tsx     # Title, badges, status, action buttons (resolve/escalate)
├── ticket-message-thread.tsx    # Message list (reporter visible + internal notes toggle)
├── ticket-reply-box.tsx         # Reply form with quick-reply picker
├── ticket-ai-suggestion.tsx     # Yellow "Saran AI" card with KB match + confidence
└── ticket-sla-badge.tsx         # Live countdown with color transitions
```

`tickets/page.tsx` is the orchestrator — reads `?selected=`, renders `<TicketList>` + `<TicketDetail>` side by side. Components are added incrementally per phase.

### Schema Organization

DB schemas are consolidated (not one file per table). Existing schema file mapping:

| Table                | Defined In                                                  |
| -------------------- | ----------------------------------------------------------- |
| `modules`            | `src/db/schema/modules.ts`                                  |
| `user_modules`       | `src/db/schema/modules.ts`                                  |
| `sla_configs`        | `src/db/schema/modules.ts`                                  |
| `tickets`            | `src/db/schema/tickets.ts`                                  |
| `ticket_messages`    | `src/db/schema/tickets.ts`                                  |
| `ticket_escalations` | `src/db/schema/tickets.ts`                                  |
| `knowledge_base`     | `src/db/schema/knowledge-base.ts`                           |
| `ai_suggestions`     | `src/db/schema/knowledge-base.ts`                           |
| `quick_replies`      | `src/db/schema/knowledge-base.ts`                           |
| `notifications`      | `src/db/schema/notifications.ts`                            |
| `users`              | re-exported from `auth-schema` via `src/db/schema/users.ts` |

---

## Phase 1 — Foundation

_Goal: get the bare minimum working so a real ticket can be created and viewed._

### Project setup

- Initialize the project with your chosen stack (Next.js recommended)
- Set up Drizzle ORM with a PostgreSQL database
- Create the database from the schema file — run your first migration
- Set up environment variables (database URL, etc.)

### What to build

- **Modules table seeded** with the initial list: IGD, Farmasi, Billing, Rawat Inap, Rawat Jalan, Radiologi, Laboratorium, Rekam Medis
- **Users table seeded** with at least one admin and one test agent
- **SLA configs seeded** — set default response and resolution times per module and priority
- **Basic ticket creation** — a simple form (title, description, module, priority) that inserts a row into the `tickets` table
- **Ticket list page** — shows all tickets with status, module color dot, priority badge, and SLA countdown
- **Ticket detail panel** — split-pane right side shows the full thread of messages for the selected ticket (via `?selected=`)

At the end of Phase 1 you should be able to manually create a ticket and see it in a list. No AI, no WhatsApp yet.

---

## Phase 2 — User Roles & Auth

_Goal: different people log in and see different things._

### What to build

- **Authentication** — login with email and password (Better Auth already set up)
- **Role-based access:**
  - `reporter` — can only see their own tickets
  - `agent` — can see all tickets in their assigned modules
  - `engineer` — can see tickets escalated to them
  - `admin` — sees everything, manages modules and users
- **User management page (admin only)** — create users, assign roles, assign modules
- **Module management** — admin-only modal/dialog for adding, editing, deactivating modules and their colors (triggered from sidebar gear icon)
- **SLA config** — admin-only modal/dialog for setting response and resolution time per module + priority

At the end of Phase 2 you have a working multi-role app with real login. Reporters can submit tickets through the web UI.

---

## Phase 3 — Ticket Workflow

_Goal: tickets can move through their full lifecycle with a real conversation thread._

### What to build

- **Reply box on ticket detail panel** — agents and engineers can type and send a reply, saved as a `ticket_message`
- **Internal notes tab** — separate from the reporter-visible thread ("Catatan Internal" in the UI)
- **Status transitions** — buttons to move a ticket: open → in progress → waiting → resolved → closed
- **Manual assignment** — admin or agent can assign a ticket to a specific engineer
- **Escalation** — a button that escalates the ticket to an engineer, creates a row in `ticket_escalations`, and notifies them
- **Quick replies** — agents can save and reuse common reply templates ("Sedang dicek", "Coba refresh", etc.) — managed on `/app/quick-replies`
- **SLA badge** — tickets show a live countdown; color changes to warning (yellow) or breached (red) based on deadline

At the end of Phase 3 the core helpdesk loop is complete. Agents can handle tickets end-to-end without any AI.

---

## Phase 4 — WhatsApp Integration

_Goal: reporters can create and reply to tickets by just sending a WhatsApp message — no web login needed._

### What to build

- **WhatsApp Business API connection** — register a WA Business number, connect it via a provider like Fonnte, Wablas, or Twilio
- **Incoming webhook endpoint** — a URL on your server that WhatsApp calls every time a reporter sends a message
- **Ticket auto-creation** — when a new WA message comes in from an unknown conversation, automatically create a ticket with `source: whatsapp`
- **Message threading** — if a message comes from a phone number that already has an open ticket, append it as a new `ticket_message` instead of creating a duplicate ticket
- **Outgoing replies** — when an agent replies from the dashboard, the reply is also sent back to the reporter's WhatsApp automatically
- **Reporter phone linking** — match the incoming WA phone number to a `users` row so the reporter is identified

This is the most technically involved phase. The webhook endpoint is the critical piece — get that right first before building the reply flow.

---

## Phase 5 — AI Triage

_Goal: the AI bot automatically classifies new tickets and tries to solve them before a human gets involved._

### What to build

- **AI triage trigger** — after a ticket is created, automatically call the AI with the ticket content
- **Module classification** — AI reads the message and picks the most likely SIMRS module with a confidence score; saved to `tickets.module_confidence` and `tickets.module_set_by`
- **Priority classification** — AI assesses urgency based on language signals (e.g. "antrian menumpuk", "tidak bisa akses") and sets an initial priority
- **Knowledge base search** — AI searches `knowledge_base` for a relevant article and returns the best match with a confidence score
- **AI reply** — if confidence is high enough, the AI sends an automatic first reply to the reporter suggesting the KB article; this is saved as a `ticket_message` with `sender_type: ai_bot`
- **AI suggestion card** — on the ticket detail panel, show the yellow "Saran AI" card (as in the UI screenshot) with the KB match and confidence percentage
- **Feedback on AI suggestion** — agents can mark the AI suggestion as helpful or not (saved to `ai_suggestions.was_helpful`)

One important rule: if the AI confidence is below a threshold (e.g. below 50%), skip the auto-reply and just flag it for an agent instead of sending a wrong answer to the reporter.

---

## Phase 6 — Knowledge Base

_Goal: agents can build and maintain the KB articles the AI uses._

### What to build

- **KB article list page** — searchable list of all articles, filterable by module
- **KB article editor** — create and edit articles with a title, content, module tag, and free-form tags
- **KB article detail page** — shows the full article content
- **Link tickets to KB** — on a resolved ticket, agents can mark which KB article solved it (improves AI training data over time)
- **KB gap detection** — a report showing tickets where the AI had low confidence or no match, flagging which topics need new articles

---

## Phase 7 — Notifications

_Goal: the right people get alerted at the right time without constantly refreshing the app._

### What to build

- **In-app notification bell** — shows unread count, clicking opens a dropdown of recent notifications
- **Notification types to implement:**
  - Ticket assigned to you
  - New message on your ticket
  - SLA warning (approaching deadline)
  - SLA breached
  - Ticket escalated to you
  - Ticket resolved
- **Real-time updates** — use WebSockets or server-sent events so the ticket list and notification bell update live without refreshing
- **WhatsApp notification** — for critical tickets, optionally send a WA message to the assigned engineer's phone as well

---

## Phase 8 — Analytics

_Goal: give the SIMRS team data to understand what's breaking and what to improve._

### What to build

- **Analytics dashboard page** — accessible to admin and agents
- **Key metrics to show:**
  - Total tickets by module (bar chart) — which module has the most problems
  - Most common ticket topics — helps SIMRS team know what to fix or document
  - AI resolution rate — % of tickets solved by AI vs human
  - Average resolution time per module
  - SLA breach rate per module
  - Repeat issues — same problem reported more than once
- **Root cause breakdown** — pie chart of `root_cause` values (bug, user error, network, third party, etc.)
- **KB gap report** — topics with no KB article and high ticket volume

All of this can be built with SQL queries against existing tables — no separate analytics database needed at this stage.

---

## Suggested Build Order Summary

| Phase | What you get                            |
| ----- | --------------------------------------- |
| 1     | Database + basic ticket CRUD            |
| 2     | Login, roles, user management           |
| 3     | Full ticket workflow, SLA, escalation   |
| 4     | WhatsApp creates and replies to tickets |
| 5     | AI classifies and tries to auto-resolve |
| 6     | Knowledge base that feeds the AI        |
| 7     | Real-time notifications                 |
| 8     | Analytics dashboard                     |

Each phase is usable on its own. You can go live after Phase 3 with manual ticketing, then add WhatsApp and AI in later phases without rebuilding anything.

---

# DETAILED IMPLEMENTATION

## Phase 1 — Foundation

**`src/db/schema/`**

- All tables already exist in consolidated schema files (see Schema Organization above). No new schema files needed.

**`scripts/`**

- `seed.ts` — seeds modules, sla_configs, and one admin user so you have something to work with. Expand the existing `seed-user.ts`.

**`src/services/`**

- `ticket.service.ts` — fill it in: get all tickets, get ticket by id, create ticket
- `module.service.ts` — fill it in: get all modules

**`src/actions/`**

- `tickets.actions.ts` — fill it in: server action to create a ticket from the form

**`src/components/tickets/`**

- `ticket-list.tsx` — left pane with tabs (inbox, waiting, done) + search + scrollable ticket list
- `ticket-list-item.tsx` — single ticket card showing status, module, priority, SLA
- `ticket-detail.tsx` — right pane placeholder for selected ticket detail
- `ticket-sla-badge.tsx` — live SLA countdown with color transitions (safe → warning → breached)

**`src/app/app/tickets/`**

- `page.tsx` — already exists as split-pane layout. Build out: reads `?selected=` from URL, renders `<TicketList>` (left) + `<TicketDetail>` (right)

---

## Phase 2 — Auth & Roles

Better Auth is already set up. What's missing:

**`src/app/app/users/`**

- `page.tsx` — already exists, build out the user list and invite form

**`src/components/`**

- `settings-dialog.tsx` — admin-only modal/dialog for module management (CRUD, colors, activate/deactivate) and SLA config (response/resolution time per module + priority). Triggered from sidebar gear icon.

**`src/services/`**

- `user.service.ts` — fill it in: get users, update role, assign modules

**`src/actions/`**

- `users.actions.ts` — create user, update role, assign modules
- `modules.actions.ts` — create module, toggle active, update SLA config

**`src/middleware.ts`**

- Already exists — add role-based route protection where needed (e.g. only admin can open settings dialog)

---

## Phase 3 — Ticket Workflow

**`src/components/tickets/`**

- `ticket-detail-header.tsx` — ticket title, badges (status, priority, source, SLA), action buttons (resolve, escalate, assign)
- `ticket-message-thread.tsx` — message list with tabs for reporter-visible thread vs internal notes
- `ticket-reply-box.tsx` — reply form with quick-reply template picker

**`src/app/app/quick-replies/`**

- `page.tsx` — manage quick reply templates (list + create/edit form)

**`src/actions/`**

- `messages.actions.ts` — send reply, send internal note
- `escalations.actions.ts` — escalate ticket to engineer
- `quick-replies.actions.ts` — create, edit, delete quick replies

**`src/services/`**

- `ticket.service.ts` — add: update status, assign ticket, resolve ticket, get messages by ticket

---

## Phase 4 — WhatsApp

**`src/app/api/`**

- `webhook/whatsapp/route.ts` — the endpoint WhatsApp calls when a message comes in

**`src/services/`**

- `whatsapp.service.ts` — fill it in: send message out, parse incoming payload

**`src/worker/`**

- `bot.ts` — fill it in: the logic that decides whether to create a new ticket or append to an existing one based on phone number

**`src/lib/`**

- `whatsapp.ts` — WA API client config (base URL, token, helper to call the API)

---

## Phase 5 — AI Triage

**`src/app/api/`**

- `triage/route.ts` — internal API route that triggers AI classification on a ticket

**`src/services/`**

- `ai.service.ts` — calls the AI, returns module classification + priority + KB match

**`src/worker/`**

- `triage.worker.ts` — the job that runs after a ticket is created: calls ai.service, saves results, sends AI reply if confident

**`src/lib/`**

- `ai.ts` — AI client config (Anthropic SDK setup, base prompt templates)

**`src/components/tickets/`**

- `ticket-ai-suggestion.tsx` — yellow "Saran AI" card with KB match, confidence %, helpful/not helpful feedback

**`src/actions/`**

- `ai-suggestions.actions.ts` — mark suggestion as helpful or not

---

## Phase 6 — Knowledge Base

**`src/app/app/knowledge/`**

- `page.tsx` — already exists, build out article list with search and module filter
- `[id]/page.tsx` — article detail view
- `new/page.tsx` — create article form
- `[id]/edit/page.tsx` — edit article form

**`src/services/`**

- `knowledge.service.ts` — fill it in: get all articles, get by id, search by keyword, get by module

**`src/actions/`**

- `knowledge.actions.ts` — create article, update article, delete article

---

## Phase 7 — Notifications

**`src/app/api/`**

- `notifications/route.ts` — SSE (server-sent events) endpoint for real-time updates

**`src/services/`**

- `notification.service.ts` — create notification, get unread by user, mark as read

**`src/actions/`**

- `notifications.actions.ts` — mark notification as read, mark all as read

**`src/hooks/`**

- `use-notifications.ts` — client hook that connects to the SSE endpoint and keeps unread count in state

**`src/components/`**

- `notification-bell.tsx` — the bell icon with badge and dropdown, used in the sidebar header

---

## Phase 8 — Analytics

**`src/app/app/analytic/`**

- `page.tsx` — already exists, build out the charts and metric cards

**`src/services/`**

- `analytics.service.ts` — all the aggregation queries (tickets by module, AI resolution rate, SLA breach rate, root cause breakdown, top topics)

**`src/actions/`**

- `analytics.actions.ts` — server actions that call analytics.service and return data to the page

---

## Summary of new files to create

| File                                               | Phase |
| -------------------------------------------------- | ----- |
| `scripts/seed.ts` (expand existing `seed-user.ts`) | 1     |
| `src/components/tickets/ticket-list.tsx`           | 1     |
| `src/components/tickets/ticket-list-item.tsx`      | 1     |
| `src/components/tickets/ticket-detail.tsx`         | 1     |
| `src/components/tickets/ticket-sla-badge.tsx`      | 1     |
| `src/components/settings-dialog.tsx`               | 2     |
| `src/actions/users.actions.ts`                     | 2     |
| `src/actions/modules.actions.ts`                   | 2     |
| `src/components/tickets/ticket-detail-header.tsx`  | 3     |
| `src/components/tickets/ticket-message-thread.tsx` | 3     |
| `src/components/tickets/ticket-reply-box.tsx`      | 3     |
| `src/app/app/quick-replies/page.tsx`               | 3     |
| `src/actions/messages.actions.ts`                  | 3     |
| `src/actions/escalations.actions.ts`               | 3     |
| `src/actions/quick-replies.actions.ts`             | 3     |
| `src/app/api/webhook/whatsapp/route.ts`            | 4     |
| `src/lib/whatsapp.ts`                              | 4     |
| `src/worker/bot.ts` (fill in)                      | 4     |
| `src/services/ai.service.ts`                       | 5     |
| `src/lib/ai.ts`                                    | 5     |
| `src/worker/triage.worker.ts`                      | 5     |
| `src/app/api/triage/route.ts`                      | 5     |
| `src/components/tickets/ticket-ai-suggestion.tsx`  | 5     |
| `src/actions/ai-suggestions.actions.ts`            | 5     |
| `src/app/app/knowledge/[id]/page.tsx`              | 6     |
| `src/app/app/knowledge/new/page.tsx`               | 6     |
| `src/app/app/knowledge/[id]/edit/page.tsx`         | 6     |
| `src/actions/knowledge.actions.ts`                 | 6     |
| `src/services/notification.service.ts`             | 7     |
| `src/app/api/notifications/route.ts`               | 7     |
| `src/actions/notifications.actions.ts`             | 7     |
| `src/hooks/use-notifications.ts`                   | 7     |
| `src/components/notification-bell.tsx`             | 7     |
| `src/services/analytics.service.ts`                | 8     |
| `src/actions/analytics.actions.ts`                 | 8     |
