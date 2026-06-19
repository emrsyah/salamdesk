# Design System: SalamDesk

**Project:** SalamDesk — Modern AI Helpdesk (Indonesian-language SIMRS / hospital ticketing)
**Source of truth:** `src/app/globals.css`, `components.json` (shadcn · `radix-maia` style · base `zinc`), `src/app/app/tickets/*` and `src/components/tickets/*`
**Reference screen:** Ticket Inbox (three-pane: sidebar navigation · ticket list · conversation detail)

This document is the semantic source of truth for generating new SalamDesk screens. Describe new work in this visual language and it will sit seamlessly alongside the existing product.

---

## 1. Visual Theme & Atmosphere

SalamDesk feels **calm, dense, and utilitarian** — a professional operator's console rather than a consumer app. It is built for triage: scanning many tickets quickly, understanding SLA pressure at a glance, and acting without ceremony.

The atmosphere is **bright and airy on a clean white canvas**, with information organized into quiet, low-contrast surfaces. Color is used **functionally, never decoratively** — a near-monochrome zinc-grey foundation lets a small set of saturated status colors (sky, violet, emerald, red, orange) carry meaning. The single brand gesture is a **warm golden-yellow** reserved for the primary commit action and for AI moments.

The mood is **efficient with moments of intelligence**: most of the UI recedes into soft greys, then an **amber "Saran AI" panel glows** to mark where the AI assistant is contributing — the one place the interface allows itself a gentle gradient and a touch of delight.

Density is **high but legible**: small type (11–14px), tight 4px-rhythm spacing, and pill/chip metadata everywhere. Nothing shouts; hierarchy comes from weight and color role, not size or shadow.

---

## 2. Color Palette & Roles

### Foundation (zinc-based neutrals, defined in OKLCH)

| Descriptive Name | Value | Role |
|---|---|---|
| **Pure White** | `oklch(1 0 0)` → `#FFFFFF` | App background, cards, popovers — the dominant canvas |
| **Near-Black Ink** | `oklch(0.141 0.005 285.8)` → `~#18181B` (zinc-950) | Primary foreground text, headings |
| **Whisper Grey** | `oklch(0.985 0 0)` → `~#FAFAFA` | Sidebar surface, subtle raised panels |
| **Soft Cloud Grey** | `oklch(0.967 0.001 286.4)` → `~#F4F4F5` (zinc-100) | Secondary / muted / accent backgrounds, hover fills |
| **Muted Slate** | `oklch(0.552 0.016 285.9)` → `~#71717A` (zinc-500) | Muted-foreground: metadata, timestamps, secondary labels |
| **Hairline Border** | `oklch(0.92 0.004 286.3)` → `~#E4E4E7` (zinc-200) | All borders, dividers, input strokes |
| **Focus Ring Grey** | `oklch(0.705 0.015 286.1)` → `~#A1A1AA` | Keyboard focus ring |

### Brand & Action

| Descriptive Name | Value | Role |
|---|---|---|
| **SalamDesk Gold** | `oklch(0.852 0.199 91.9)` ≈ `#FACC15` (yellow-400) | **Primary brand color.** The "Selesai" (Resolve) commit button, selected-item left accent rail, primary CTA fills |
| **Deep Amber-Brown** | `oklch(0.421 0.095 57.7)` ≈ `#713F12` (yellow-950) | Text/icon color on gold surfaces — high-contrast warm ink |
| **Alert Red** | `oklch(0.577 0.245 27.3)` ≈ `#DC2626` | Destructive actions |

### AI Accent (the one expressive zone)

| Descriptive Name | Value | Role |
|---|---|---|
| **Intelligence Amber** | `amber-50 → yellow-50` gradient, `amber-200` border | AI suggestion panels ("Saran AI"), the soft glow that marks AI-generated content |
| **Sparkle Amber** | `amber-600` (`#D97706`) | AI iconography (`RiSparklingLine`), AI confidence labels, copilot toggle |

### Semantic Status Spectrum

Each status owns a hue, always rendered as a **tinted-50 background + 200/70 border + 700 text** pill (the signature SalamDesk chip recipe):

| Meaning | Color family | Example |
|---|---|---|
| **Open / Terbuka** | Sky / Blue | `bg-sky-50 text-sky-700 border-sky-200/70` |
| **In Progress / Dikerjakan** | Violet / Purple | `bg-violet-50 text-violet-700 border-violet-200/70` |
| **Resolved / Selesai** | Emerald / Green | `bg-emerald-50 text-emerald-700 border-emerald-200/70` |
| **Closed / Ditutup** | Slate / Grey | `bg-slate-50 text-slate-600 border-slate-200/70` |

### Priority & SLA

| Meaning | Color | Notes |
|---|---|---|
| **Low / Rendah** | Blue (`blue-700` on `blue-50`) | Calm |
| **Normal / Medium** | Orange (`orange-700` on `orange-50`) | Neutral-default |
| **Critical / Kritis** | Red (`red-700` on `red-50`) | Urgent |
| **SLA Safe** | Green (`text-green-600 bg-green-50`) | On track |
| **SLA Warning** | Yellow (`text-yellow-600 bg-yellow-50`) | Approaching breach |
| **SLA Breached** | Red (`text-red-500 bg-red-50`) | Overdue — "Lewat 29j 40m" |

### Module Color Dots

Each SIMRS module (Billing, Farmasi, Radiologi…) carries a **user-defined hex color** rendered as a tiny `size-2 rounded-sm` square. Fallback when unset: **Slate `#94a3b8`**.

> **Note:** A full dark theme is defined (`.dark` in `globals.css`) mirroring every token. The product is light-first; dark mode inverts surfaces to zinc-900/950 and brightens the gold.

---

## 3. Typography Rules

- **Body / UI font:** **Geist** (`--font-sans`) — a clean, neutral grotesque. Applied globally to `html`. Antialiased.
- **Heading / accent font:** **Geist Mono** (`--font-heading`) — monospace, reserved for headings and lends a technical, console-like character.
- **Monospace:** **Geist Mono** (`--font-mono`) — IDs, codes.

**Weight & size discipline (the system runs small):**

| Element | Treatment |
|---|---|
| Ticket detail title | `text-xl font-bold leading-tight tracking-tight` |
| List item title | `text-sm font-semibold leading-snug`, clamped to 2 lines |
| Body / message text | `text-sm leading-relaxed` |
| Metadata, chips, timestamps | `text-xs` / `text-[11px] font-medium leading-4` |
| Ticket ID (`#D8579A8C`) | `text-xs font-semibold`, uppercased, muted |
| Section labels | `text-xs font-medium text-muted-foreground` |

**Character:** Headings get **tight negative tracking** for a confident, compact feel. Metadata leans on `font-medium` + muted color rather than size changes to establish hierarchy. Almost nothing exceeds 20px.

---

## 4. Component Stylings

**Buttons**
- **Primary commit ("Selesai"):** `bg-yellow-400 text-yellow-950 hover:bg-yellow-500`, `border-0`, gap-1.5 with a leading icon. Subtly rounded (md). The unmistakable gold action.
- **Secondary ("Rute"):** `variant="outline"` — white fill, hairline zinc border, dark text.
- **Tertiary / icon actions:** `variant="ghost" size="icon" size-9` — invisible until hover; toggles flip to `variant="secondary"` (soft grey fill) when active (`aria-pressed`).
- All buttons: `cursor: pointer` enforced globally; corners **subtly rounded** (`--radius: 0.625rem` / 10px base).

**Cards / List Items**
- Ticket rows are **borderless cards separated by a single bottom hairline** (`border-b`), not floating boxes.
- **Selection is signaled by a 4px left accent rail** (`border-l-4`): `border-l-primary` (gold) + `bg-muted/25` when selected; `border-l-transparent` otherwise.
- Hover: `hover:bg-muted/45` — a barely-there grey wash. Transitions are `transition-colors`.

**Chips & Badges (the core visual idiom)**
- Two shapes: **pill** (`rounded-full`) for status, **soft-rectangle** (`rounded` / `rounded border`) for priority, assignee, and SLA.
- Recipe: `border px-2 py-0.5 text-[11px] font-medium leading-4` + the tinted-50 / 200-border / 700-text triad.
- Often lead with a `size-3` Remix icon. "Unassigned" uses a **dashed border** (`border-dashed`) to read as an empty slot.

**Inputs / Forms**
- `h-10 rounded-md border border-input bg-background px-3 py-2 text-sm`.
- Focus: `focus:ring-2 focus:ring-ring focus:ring-offset-2`, no outline. Stroke-based, flat, white-filled — never heavy.
- Inline editable metadata uses **InlinePicker** triggers: text that reveals `hover:bg-muted` + `hover:ring-2 hover:ring-ring/30` to hint editability without chrome.

**AI Suggestion Panel (signature element)**
- `rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 shadow-sm`.
- The **only gradient and the only place "xl" rounding appears** — deliberately distinct so AI contributions feel set apart and intelligent.
- Sparkle icon in a soft `bg-amber-400/20` circle; collapsible; entrance animation `animate-in fade-in slide-in-from-top-2 duration-300`.

**Icons:** **Remix Icon** (`@remixicon/react`), line-weight variants (`Ri…Line`), typically `size-3` to `size-4`. Consistent, thin, neutral.

---

## 5. Layout Principles

- **Three-pane operator console:** fixed left **sidebar** (whisper-grey, brand + module navigation), a **scrollable ticket list** (~`w-[400px]` middle column with its own search/filter header and Inbox/Selesai tabs), and a **flexible conversation detail** pane that fills remaining space. Optional right-side panels (Requester profile, AI Copilot) slide in.
- **Sticky context headers:** the detail header is `sticky top-0 z-10 bg-background border-b`, generous horizontal padding (`px-8 py-3`), so ticket identity and actions stay anchored while the thread scrolls.
- **4px spacing rhythm:** gaps cluster at `gap-1.5`, `gap-2`, `gap-2.5`; padding at `p-4` (list rows) and `px-8` (detail). Dense but never cramped — whitespace does the separating, lines only where structure demands.
- **Dividers over boxes:** structure comes from **single hairline borders and thin vertical rules** (`h-5 w-px bg-border`) between metadata clusters, not nested containers or shadows.
- **Flat elevation:** shadows are nearly absent. Only `shadow-sm` appears, on the AI panel and floating menus. Depth is communicated by **border + background tint**, keeping the UI calm and print-like.
- **Action grouping by mental model:** in headers, workflow actions (change the ticket) and layout toggles (change the view) are split into clusters separated by a vertical `Separator` — a recurring organizing principle worth preserving.
- **Right-to-act, left-to-scan:** identity, status, and metadata read left; commit/destructive actions and panel toggles pin to the right edge.

---

## Generation Cheat-Sheet

When prompting for new SalamDesk screens, anchor on these:

1. **White canvas, zinc-grey furniture, gold only for the primary commit.**
2. **Status = color-coded pill** (tinted-50 / 200-border / 700-text + line icon).
3. **Small type, medium weights, mono headings**, tight tracking.
4. **Hairlines and tints, not shadows and boxes.** Flat by default.
5. **AI content glows amber** with a soft gradient, sparkle icon, and xl rounding — the one expressive exception.
6. **10px base radius**: chips full/rounded, cards & inputs md, AI panel xl.
7. **Indonesian-language UI**; dense, scan-first, operator-grade.
