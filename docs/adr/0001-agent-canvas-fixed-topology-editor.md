# Agent Canvas: a fixed-topology visual editor that mirrors the triage engine

We added a fifth tab under `/app/app/agent` (the "Agent Canvas") that renders the
triage pipeline as a react-flow graph and lets admins edit each stage's AI config
by selecting its node. The graph's **topology is locked** — nodes and edges mirror
how `triage.service.ts` actually runs and cannot be added, removed, or rewired —
so the visual can never disagree with the real engine. It is a settings editor, not
a flow builder.

## Status

accepted

## Considered Options

- **Freeform flow builder** (drag/wire arbitrary nodes) — rejected. The pipeline
  order is hardcoded in `triage.service.ts`; honoring a user-built graph would
  require a graph interpreter in the worker, validation, and migration — months of
  work and high risk, for no current product need.
- **Replace the existing Otomasi form tab** — rejected. We keep the dense forms as
  the "advanced" view. The canvas is an *alternate* view of the **same** singleton
  `ai-config`, edited through the **same** server actions, so the two never drift.
- **Read-only map that links out to the forms** — rejected. We wanted real
  on-canvas editing, not just navigation.

## Consequences

- The pipeline topology is extracted to a shared module (`lib/agent/pipeline-topology.ts`)
  imported by both the exhibit `TriageGraph` (live monitor) and the Agent Canvas
  (editor), so the engine, the monitor, and the editor stay in lockstep.
- The same automation fields are now editable in two places (the Otomasi form and
  the canvas). This is intentional and safe because both write the one singleton
  row; it is **not** a bug to "fix" by deduplicating the UI.
- When `triage.service.ts` changes shape, the shared topology module must be
  updated — that is the single place that keeps all three views honest.
