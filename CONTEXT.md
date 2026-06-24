# SalamDesk — Context

Shared language for the SalamDesk AI helpdesk. Terms here are meaningful to
domain experts (admins configuring the agent), not implementation details.

## Glossary

### Agent Canvas
A visual, node-based view of the AI agent's configuration, rendered with
react-flow as a **fifth tab** under `/app/app/agent`. It draws the triage
pipeline as a locked DAG (the same topology as the exhibit `TriageGraph`) and
lets an admin edit each stage's settings by selecting its node. It is an
**editor of settings**, not a flow builder: the topology is fixed and mirrors
how `triage.service.ts` actually runs. The canvas can never disagree with the
real engine.

### Stage node
One node on the Agent Canvas representing a single step of the triage engine
(e.g. "Klasifikasi modul", "Gerbang auto-reply"). Selecting a stage node opens
a **side drawer** (Sheet, docked right) where the admin edits the subset of AI
config that stage owns. Wiring between stage nodes is read-only.

Each node's settings **save independently** via a partial `updateAiConfig()`
call from its drawer — there is no global canvas-wide save. Closing a drawer
without saving discards that node's pending edits.

The drawer uses a **bespoke, canvas-native shell** (no whole-tab chrome) with
simple controls (toggles, sliders, chips) rebuilt for a cohesive look. Genuinely
complex **leaf widgets are reused unchanged** inside that shell — specifically
the TipTap procedure editor (`procedure-editor/`) and the tool credential /
OAuth UI. The canvas is a **fifth tab that coexists** with the four existing
form tabs; both edit the same singleton config via the same server actions, so
they never drift.

### Master switch
A pipeline-wide mode that gates the whole engine rather than one stage:
`aiTriageEnabled`, `autoReplyEnabled`, and `aiFirstMode`. On the Agent Canvas
these live in a **toolbar above the graph**, not in any node. Disabling Triage
dims the whole graph; AI-first visibly marks the gate sub-settings it bypasses.

### Pipeline topology
The single shared definition of the triage graph's nodes, edges, and hand-laid
positions, extracted to a shared module (e.g. `lib/agent/pipeline-topology.ts`).
Both the exhibit `TriageGraph` (live monitor) and the Agent Canvas (editor)
import it and render their own node components, so the two views never drift.

The Agent Canvas is **desktop-first**. Below a breakpoint it falls back to the
existing (mobile-tuned) form tabs with a pointer note; node drawers go
full-screen if opened. Each stage node shows its current settings as **static
value badges** (e.g. "conf 0.5", "auto-reply ON") so the canvas is readable
without opening drawers — there is no live ticket animation on this screen
(that stays in the exhibit).

### Triage pipeline
The branching DAG the agent runs per inbound message: intake → (parallel
classifiers: module / priority / off-topic guard) → KB search → reply builders
(KB answer / procedure / tools) → auto-reply gate → reply. Hardcoded in
`triage.service.ts`; visualised live in the exhibit and configured on the
Agent Canvas.
