# Implementation Plan — Agent Canvas

A visual, node-based fifth tab under `/app/app/agent` for editing the AI agent's
configuration. See `CONTEXT.md` (glossary) and
`docs/adr/0001-agent-canvas-fixed-topology-editor.md` (why) for the design rationale.

**Core principle:** the canvas is a *settings editor* over a *locked* topology that
mirrors `triage.service.ts`. It coexists with the four existing form tabs and writes
the same singleton `ai-config` via the same server actions, so the views never drift.

Build order is smallest-honest-slice first; each phase is independently shippable.

---

## Phase 0 — Extract shared topology (safe refactor, no behavior change)

**Goal:** one source of truth for the pipeline graph, consumed by both the exhibit
monitor and the new canvas.

- Create `src/lib/agent/pipeline-topology.ts`:
  - Move `NODE_DEFS` (id, icon, label, x, y, optional) and `EDGE_DEFS` (from, to,
    optional) out of `src/components/exhibit/pipeline-graph.tsx`.
  - Also move `NODE_OF` (event-type → node id) — it's topology-adjacent and the
    exhibit needs it; the canvas does not.
  - Export stable TypeScript types: `PipelineNodeId`, `PipelineNodeDef`, `PipelineEdgeDef`.
- Update `pipeline-graph.tsx` to import from the new module. **No visual change.**
- Verify the other two consumers still build: `pipeline-theater.tsx`,
  `src/app/exhibit/demo/page.tsx` (they import `TriageGraph`, not the defs, so they
  should be untouched — confirm).

**Done when:** exhibit renders identically and `tsc`/lint pass. Pure refactor.

---

## Phase 1 — Static read-only canvas tab

**Goal:** the new tab renders the locked graph with current-value badges. No editing yet.

- Add nav item to `src/components/agent/agent-sub-nav.tsx`:
  `{ href: "/app/agent/canvas", label: "Kanvas" }` (append after Prosedur).
- Create route `src/app/app/agent/canvas/page.tsx` (server component):
  - `const config = await getAiConfig()` and pass the whole `AiConfig` to the client.
- Create `src/components/agent/canvas/agent-canvas.tsx` (`"use client"`):
  - Render `<ReactFlow>` from the shared topology, mirroring the exhibit's locked
    setup: `nodesDraggable={false}`, `nodesConnectable={false}`, `panOnDrag`,
    `zoomOnScroll`, `proOptions={{ hideAttribution: true }}`, `<Background>`,
    `<Controls showInteractive={false}>`. Import `@xyflow/react/dist/style.css`.
  - New node component `ConfigNode` (distinct from the exhibit's `TriageNode`):
    name + icon + **static value badges** derived from `config`
    (e.g. Classify → "conf 0.7 · modul ON"; Gate → "auto-reply ON · delay 0m · 3 kanal").
  - A `nodeConfigSummary(nodeId, config)` helper maps each node id → its badge strings.
    This is the read-side mirror of the write-side field-ownership map in Phase 3.
- **Mobile fallback:** below `md`, hide the canvas and show a note + links to the
  Otomasi/Perilaku tabs ("Kanvas paling baik di layar lebar.").

**Done when:** the tab shows the pipeline with accurate live badges; nothing is clickable.

---

## Phase 2 — Drawer shell + master-switch toolbar + ONE editable node (Gate)

**Goal:** prove the full edit→save→reflect loop on the hardest-but-most-valuable node.

- **Toolbar** above the graph: three master switches — `aiTriageEnabled`,
  `autoReplyEnabled`, `aiFirstMode`. Each toggle calls `updateAgentAutomationAction`
  with just its field, then `router.refresh()`. When `aiTriageEnabled` is off, dim the
  whole graph (reduced opacity + `pointer-events` guidance). When `aiFirstMode` is on,
  flag it so the Gate drawer can mark bypassed sub-settings.
- **Drawer:** use the existing `src/components/ui/sheet.tsx` docked right. Canvas-native
  bespoke layout (no `AgentTabIntro`/`AgentSection` chrome). Selecting a node opens it;
  closing without saving discards local edits.
- **Gate node drawer** — full inline controls for the gate's fields:
  `autoReplyEnabled`, `replyConfidenceThreshold`, `skipCriticalPriority`,
  `requireKbGrounding`, `limitAutoRepliesPerTicket` (+ `maxAutoRepliesPerTicket`),
  `autoReplyDelayMinutes`, `autoReplyChannels` (chips), `blockedKeywords` (tags),
  plus business-hours (`businessHours`, `offHoursReplyEnabled`, `offHoursMessage`).
  - Rebuild the simple controls canvas-native (toggle, number, chips, tag input).
  - Reuse the `aiFirstMode`-bypass affordance pattern from `SettingRow` (strike-through
    + "Dilewati AI-first" badge) where it applies.
  - **Save** button → `updateAgentAutomationAction(localDrawerState)` →
    `router.refresh()` → toast (`sonner`, matching existing forms).
- Make `ConfigNode` selectable and wire click → open drawer for that node id.

**Done when:** editing the Gate on the canvas persists and the node badge + Otomasi
form both reflect the change after refresh.

---

## Phase 3 — Remaining automation nodes

**Goal:** every automation stage editable on the canvas.

Per-node field ownership (each drawer saves only its fields via `updateAgentAutomationAction`):

| Node | Fields |
|---|---|
| Klasifikasi modul | `autoClassifyModule`, `moduleConfidenceThreshold` |
| Nilai prioritas | `autoSetPriority` |
| Penjaga topik | `offTopicGuardEnabled` (bypassed by AI-first) |
| Cari panduan (KB) | `kbCrossModuleSearch` |
| Jalankan prosedur | `proceduresEnabled`, `procedureConfidenceThreshold` |

- Define one `NODE_FIELD_MAP` so badges (Phase 1) and drawers (Phase 3) share the
  same ownership truth.
- Each drawer is a small bespoke field group; same save→refresh→toast loop as Gate.

**Done when:** all automation nodes edit + persist correctly.

---

## Phase 4 — Reuse-leaf nodes (Tools, Prosedur, Balasan/Perilaku)

**Goal:** "everything inline" — rich editors mounted inside bespoke drawers.

- **Balasan / Perilaku node:** bespoke fields for `agentName`, `tone`, `language`,
  `replySignature` + reuse the persona/guardrails text inputs. Save via
  `updateAgentBehaviorAction`. (Behavior fields are stripped by the automation action,
  so this must use the behavior action.)
- **Tools node:** mount the **existing** `AgentToolsClient` inside the drawer (it owns
  its own CRUD via the tool/credential actions). Canvas page must fetch `listTools()` +
  `listCredentials()` to feed it — or lazy-load on drawer open. Credential/OAuth UI is
  reused unchanged (the designated complex leaf widget).
- **Prosedur node:** mount the **existing** `ProceduresClient` (incl. the TipTap
  `procedure-editor/` and mention sources) inside the drawer. Fetch `listProcedures()` +
  `getMentionSources()` for it.
- These drawers are wider than the automation ones; make drawer width per-node.

**Done when:** Tools and Procedures are fully manageable from the canvas with zero
re-implementation of the rich editors.

---

## Phase 5 — Polish

- Empty/disabled visuals: optional nodes (vision, procedures, tools, guard) render
  faint when their enabling flag is off, mirroring the exhibit's `optional` styling.
- Selected-node highlight ring; keyboard `Esc` closes drawer.
- `a11y`: drawer focus trap (Sheet handles this), node buttons have accessible labels,
  badges aren't color-only (already the project's convention).
- Confirm `revalidatePath("/app/agent/canvas")` is added to `revalidateAgent()` in
  `agent.actions.ts` so the canvas refreshes after any save.

---

## Files touched

**New**
- `src/lib/agent/pipeline-topology.ts`
- `src/app/app/agent/canvas/page.tsx`
- `src/components/agent/canvas/agent-canvas.tsx`
- `src/components/agent/canvas/config-node.tsx`
- `src/components/agent/canvas/node-drawers/*` (per-node drawer bodies + field map)

**Modified**
- `src/components/exhibit/pipeline-graph.tsx` (import topology instead of inlining)
- `src/components/agent/agent-sub-nav.tsx` (add Kanvas tab)
- `src/actions/agent.actions.ts` (add canvas path to `revalidateAgent`)

**Reused unchanged**
- `src/components/agent/agent-tools-client.tsx`
- `src/components/agent/procedures-client.tsx`
- `src/components/agent/procedure-editor/*`
- `src/components/ui/sheet.tsx`
- Actions: `updateAgentAutomationAction`, `updateAgentBehaviorAction`, tool/credential/procedure actions

## Risks / watch-list
- **Two editors, one row:** intentional (per ADR-0001). Don't "dedupe" the Otomasi form away.
- **Topology drift:** if `triage.service.ts` changes, update `pipeline-topology.ts` only.
- **Drawer data fetching:** Tools/Procedures need their own data; prefer lazy-load on
  drawer open to keep the canvas page light.
- **AI-first bypass:** the Gate drawer must reflect bypassed sub-settings or admins will
  be confused why a setting "does nothing".
