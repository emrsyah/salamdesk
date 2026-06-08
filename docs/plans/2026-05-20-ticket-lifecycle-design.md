# SalamDesk Ticket Lifecycle Design Guide

Date: 2026-05-20

## Purpose

This guide defines the improved SalamDesk ticket lifecycle. It is the product and engineering source of truth for how tickets move from intake to closure, who can act on them, what side effects happen, and which events need audit/history records.

This is a design guide, not an implementation plan. Implementation should be planned separately after this guide is accepted.

## Core Principles

SalamDesk should keep the lifecycle simple and operationally clear:

- A ticket is either waiting for ownership, actively owned, believed fixed, or finalized.
- Staff replies are part of progress. SalamDesk will not use a separate `waiting` status.
- Assignment means ownership.
- Closed tickets are final.
- SLA runs continuously from intake. It does not pause.
- AI can assist with triage and replies, but staff remains accountable for lifecycle decisions.
- Each requester contact identity should have at most one active ticket by default.

## Target Statuses

The target lifecycle uses four statuses:

| Status | Meaning |
| --- | --- |
| `open` | Newly received or returned to queue. The ticket is not currently owned by an individual staff member. It may have a module, priority, AI triage result, and messages. |
| `in_progress` | The ticket is assigned to a staff member and actively owned. Staff replies, requester replies, internal notes, investigation, escalation, and reassignment all happen inside this status. |
| `resolved` | Staff believes the issue is fixed. A resolution note has been sent to the requester. The ticket remains reopenable for 72 hours. |
| `closed` | The ticket is finalized. It is locked and cannot be reopened. Later requester contact creates a new linked ticket. |

The current `waiting` status should be removed from the target lifecycle. Existing `waiting` tickets should be migrated or treated as `in_progress`.

## State Transitions

Allowed transitions:

| From | To | Trigger |
| --- | --- | --- |
| `open` | `in_progress` | Ticket is assigned to staff, taken over, or a staff member sends a public reply on an unassigned ticket. |
| `open` | `resolved` | Staff resolves an immediate fix without needing a separate active-work step. |
| `in_progress` | `open` | Assignee explicitly unassigns or hands the ticket back to the module queue. |
| `in_progress` | `resolved` | Assigned staff, supervisor, admin, or owner resolves the ticket. |
| `resolved` | `in_progress` | Requester replies during the 72-hour confirmation window and the ticket still has an assignee. |
| `resolved` | `open` | Requester replies during the 72-hour confirmation window and the ticket has no assignee. |
| `resolved` | `closed` | Staff manually closes the ticket or auto-close runs after 72 hours. |
| `closed` | none | Closed is final. |

Disallowed transitions:

- `closed -> open`
- `closed -> in_progress`
- `closed -> resolved`
- Any direct lifecycle mutation that bypasses permission checks and audit/history.

## Assignment And Ownership

Tickets first belong to a module queue. Once assigned to an individual staff member, the ticket becomes `in_progress`.

Assignment rules:

- Any staff role can be assigned to a ticket.
- Staff can assign or reassign tickets to any staff member.
- Taking over a ticket assigned to someone else must be an explicit action.
- Takeover and reassignment must create audit/history events.
- Takeover and reassignment must notify the previous assignee and new assignee.
- Unassigning a ticket moves it back to `open`.

Changing module:

- Changing a ticket's module clears the assignee and moves the ticket back to `open`.
- Exception: the staff member can choose a new assignee during the same action.
- Module changes must create audit/history events.

Changing priority:

- Assigned staff can change priority on their own ticket.
- Supervisor, admin, and owner can change priority on any ticket.
- Same-module staff must take over before changing priority.
- Priority changes do not recalculate existing SLA deadlines.
- Priority changes must create audit/history events.

## Visibility And Permissions

Module queue visibility:

- Staff assigned to a module can see unassigned tickets in that module.
- Engineers follow the same module visibility rule as other staff.
- Supervisors, admins, and owners can see all module queues.

Assigned ticket visibility:

- Assigned staff can see their own tickets.
- Staff assigned to the same module can also see assigned tickets for team awareness.
- Supervisors, admins, and owners can see all tickets.

Actions on someone else's assigned ticket:

- Same-module staff can view it.
- Same-module staff can add internal notes.
- Same-module staff can send public replies.
- Same-module staff cannot resolve, close, reassign, or change lifecycle status unless they explicitly take over first.

Resolve and close permissions:

- Assigned staff can resolve or close their own ticket.
- Supervisors, admins, and owners can resolve or close any ticket.
- Unassigned tickets should normally be assigned before resolution, but supervisors, admins, and owners may resolve directly.

Reopen permissions:

- Requester reply during the 72-hour resolved window auto-reopens the ticket.
- Assigned staff can manually reopen their own resolved ticket.
- Supervisors, admins, and owners can manually reopen any resolved ticket.
- Closed tickets cannot be reopened by staff.

## Messaging Rules

Requester messages:

- On `open`: append message and keep status `open`.
- On `in_progress`: append message and keep status `in_progress`.
- On `resolved` within 72 hours: append message and reopen.
- On `closed`: create a new linked ticket.

Staff public replies:

- On unassigned `open` tickets, a public staff reply automatically assigns the ticket to that staff member and moves it to `in_progress`.
- On `in_progress` tickets, public replies keep the ticket `in_progress`.
- Public replies do not move tickets to `waiting`.

Internal notes:

- Internal notes do not auto-assign.
- Internal notes do not change status.
- Internal notes remain staff-visible only.

Resolution messages:

- Resolving a ticket requires a resolution note.
- The resolution note creates a public final message visible to the requester.
- For WhatsApp tickets, the resolution note is sent through WhatsApp.

Closure messages:

- Manual close is silent by default.
- Auto-close is silent by default.
- Staff may send a public message before closing if needed.

Closed ticket lock:

- No new messages.
- No reopen.
- No assignment changes.
- No module or priority changes.
- Admin and owner may make exceptional metadata corrections only.

## Resolution Requirements

Required to resolve:

- `resolutionNote`

Optional when resolving:

- `rootCause`
- linked knowledge base articles

AI must not resolve tickets automatically. Human staff must perform resolution.

## Auto-Close

Resolved tickets auto-close after 72 calendar hours.

Rules:

- The timer starts at `resolvedAt`.
- Auto-close applies to all priorities, including critical tickets.
- Requester reply before auto-close reopens the ticket.
- Staff can manually close before the 72-hour window ends.
- Auto-close must create an audit/history event.

## SLA Design

SalamDesk tracks two SLA timers:

- First response SLA: time from ticket creation to first public human staff reply.
- Resolution SLA: time from ticket creation to resolution.

SLA rules:

- SLA starts at ticket creation.
- SLA does not pause.
- Assignment does not satisfy first response SLA.
- Internal notes do not satisfy first response SLA.
- AI auto-replies do not satisfy first response SLA.
- System messages do not satisfy first response SLA.
- First response SLA is satisfied only by the first public human staff reply.
- AI auto-replies should be tracked separately as an AI response time metric.

SLA warning and breach:

- SLA warning fires at 80% elapsed time.
- SLA breach marks the relevant SLA as breached.
- SLA breach notifies assigned staff if assigned.
- SLA breach notifies supervisors/admins if unassigned or critical.
- SLA breach appears in breached filters and reports.
- SLA breach does not change ticket status.

SLA and triage:

- If a ticket is created with a committed module and priority, those values determine the initial SLA.
- If staff, API, or a requester form explicitly set module or priority, AI must not overwrite those values.
- AI may recommend a different module or priority for staff to accept or reject.
- Accepting a module or priority recommendation does not recalculate existing SLA deadlines for now.
- WhatsApp or unclassified intake tickets may start without module. If AI sets the first module and priority, SLA deadlines are computed from the original `createdAt`.

## AI Triage Governance

AI can:

- Set the initial module for unclassified intake tickets.
- Set the initial priority when the ticket only has a default intake priority.
- Recommend module or priority changes after staff/API/requester-form values exist.
- Create auto-replies when policy allows.
- Produce suggestions for staff review.

AI cannot:

- Overwrite human/API/requester-form committed module or priority.
- Resolve tickets.
- Close tickets.
- Reassign tickets.
- Recalculate SLA after a staff-owned lifecycle has started, except for initial SLA creation on previously unclassified intake tickets.

AI recommendation handling:

- Staff can accept or reject recommendations.
- Accept/reject must create audit/history events.
- Accepted module changes follow module-change rules.
- Accepted priority changes follow priority-change rules.

## One Active Ticket Rule

By default, a requester contact identity can have only one active ticket.

Active statuses:

- `open`
- `in_progress`

Identity scope:

- One active ticket per WhatsApp phone number.
- One active ticket per email identity.
- One active ticket per API external requester identity.

Manual web creation:

- If staff tries to create a new web ticket for a requester/contact identity with an active ticket, block creation.
- Show or link the existing active ticket.
- Ask staff to append a message or note to the existing ticket instead.

WhatsApp intake:

- If an active ticket exists for the WhatsApp phone, append to it.
- If the latest ticket is `resolved` and within the 72-hour window, reopen and append.
- If the latest ticket is `closed`, create a new linked ticket.

No multiple active ticket override is included for now.

## Related Tickets

Related ticket links should exist for cases where a new ticket is connected to a previous ticket.

Initial supported relationship types:

- `reopened_from`: a new ticket created because the requester contacted SalamDesk after the previous ticket was already closed.
- `duplicate_of`: a ticket identified as duplicate of another ticket.

Do not over-model broader relationship types yet. Avoid `related issue`, `blocks`, or `caused by` until the workflow requires them.

## External API Behavior

External API consumers can:

- Create tickets.
- Read tickets.
- Add requester or system updates.

External API consumers cannot:

- Resolve tickets.
- Close tickets.
- Reopen tickets.
- Assign or reassign tickets.
- Change module, priority, or status.

API updates:

- API updates on active tickets append without changing status.
- API updates on `resolved` tickets during the 72-hour window reopen the ticket.
- API updates on `closed` tickets should create a new linked ticket if they represent requester follow-up.

## Audit And History

Audit/history must record:

- Status changes.
- Assignment, reassignment, takeover, and unassignment.
- Module changes.
- Priority changes.
- SLA warning and breach.
- Resolution.
- Manual close.
- Auto-close.
- Reopen.
- AI recommendation created.
- AI recommendation accepted or rejected.
- New linked ticket created from closed ticket follow-up.

Messages already have their own table. Do not duplicate every message as an audit event unless the message causes a lifecycle side effect.

## Notifications

Notifications should be created for:

- Assignment and reassignment.
- Takeover, including previous assignee and new assignee.
- SLA warning.
- SLA breach.
- Critical unassigned ticket breach.
- Reopen from requester reply.
- New linked ticket created from closed ticket follow-up.

Resolution and close notifications:

- Resolution is communicated through the public resolution message.
- Close is silent by default.

## Implementation Notes

The current codebase has several gaps relative to this design:

- `waiting` exists in the database enum and UI but should be removed or migrated.
- `updateTicketStatus` currently allows direct status changes without transition validation.
- Staff public replies currently move tickets to `waiting`; this should change.
- `closed` exists but has no real close path.
- Auto-close does not exist yet.
- SLA currently has one deadline field and status; this design needs first-response and resolution SLA tracking.
- `resolvedByType` exists but current manual resolution does not consistently set it.
- WhatsApp currently appends to the latest non-terminal ticket by phone, but should enforce the one-active-ticket identity rule and resolved-window reopen behavior.
- API message behavior should be aligned with requester update rules.
- Audit/history should be added before enforcing stricter lifecycle rules, so migrations and behavior changes remain traceable.

## Open Questions For Implementation Planning

These do not block the lifecycle design, but they should be answered before implementation:

- Should `ticket_status` enum be migrated in place to remove `waiting`, or should `waiting` remain temporarily as a legacy value while UI hides it?
- Should SLA fields live on `tickets` directly or in a separate `ticket_slas` table?
- Should audit/history use a generic `ticket_events` table or extend the existing triage event model with separate ticket lifecycle events?
- Should auto-close be handled by BullMQ scheduled jobs, a recurring worker scan, or database-driven cron outside the app?
- How should existing `waiting` tickets be migrated: to `in_progress` when assigned, otherwise `open`?
