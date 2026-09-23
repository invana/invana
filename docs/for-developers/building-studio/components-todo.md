# Components to build — the standing list

**What this is.** Every component the drawn screens need and the kit does not have yet, with its
status. One row per component, and the row is the whole record: what it draws, where it goes, which
artboards need it, whether it is built and whether it has a story.

| This file | Its sibling |
|---|---|
| **What is still owed** — the queue, with status | [design-kit-coverage.md](design-kit-coverage.md) — the board element → component **map**, the decisions behind it, and what already shipped |
| Screens and their status | [the-screens.md](../the-screens.md) |
| Features and their status | [../README.md](../README.md) |

## How to read a row

| Column | Values |
|---|---|
| **Status** | 🔵 not started · 🟡 in progress · ✅ shipped (component **and** story) |
| **Story** | ✅ one exported story per file under `apps/storybook/stories/…` · 🔵 none yet. A component without a story is not done |
| **Where** | `ui` = `packages/ui/src/components/ui/` (shadcn-style primitive) · `ui-extended` = composition of primitives, Invana-domain ones included · `tables` · `dashboard` · `canvas-ui` (the **canvas** repo) |

**Keeping it true.** A component ships → flip its row here, and its row in
[design-kit-coverage.md](design-kit-coverage.md). An artboard is added that needs something new →
add the row here first, then build it. A row nothing cites is a component nobody agreed to build.

---

## 1. Operate › Runs — the 16 artboards

Source: `.design/canvas-govern-agents/rd.py`, audited in
[design-kit-coverage.md § 7](design-kit-coverage.md#7-operate--runs--what-the-16-artboards-need).
Feature: [10.5 · see-what-ran](../modules/operate/features/see-what-ran.md).

### 1.1 New — primitive

| # | Component | Where | What it draws | Boards | Decision | Status | Story |
|---|---|---|---|---|---|---|---|
| C1 | `SegmentedControl` | `ui` | the reading switch — `In order · Layers · Flow · Lens`, `Overview · Touched · Log`, `All · Info · Warn · Error`. Single-select, bordered frame, active filled | 16 | [SR46](../modules/operate/features/see-what-ran.md#decisions) · [SR55](../modules/operate/features/see-what-ran.md#decisions) | ✅ | ✅ |

### 1.2 New — composites

| # | Component | Where | What it draws | Boards | Decision | Status | Story |
|---|---|---|---|---|---|---|---|
| C2 | `TraceList` · `TraceStep` · `TraceLoop` · `TraceGate` | `ui-extended` | the `In order` reading. A row is a step: layer stripe · seq · key + description · mark · layer + role · duration + note. `depth` nests a delegated run; `live · queued · dim · struck · selected` are its states. A loop is a box **around** its rounds; a gate is a rule **between** rows | in_order · in_order.card · in_order.states | [SR47](../modules/operate/features/see-what-ran.md#decisions) · [SR48](../modules/operate/features/see-what-ran.md#decisions) | ✅ | ✅ |
| C3 | `TouchStrip` | `ui-extended` | one cell per layer — dot, name, count — struck when refused, dim when allowed and never touched; header states `declared 4 · touched 4 · refused 1` | in_order · in_order.card | [SR47](../modules/operate/features/see-what-ran.md#decisions) | ✅ | ✅ |
| C4 | `RunRow` | `ui-extended` | the journal row: status dot · kind chip · mono id · what it was about · meta · badge; `depth` for a child run, `live` while it paints | every board (the panel) · list | [SR45](../modules/operate/features/see-what-ran.md#decisions) · retires Studio's `WorkRow` (DS17) | ✅ | ✅ |
| C5 | `KindChip` | `ui-extended` | `ask · import · bulk · stitch · enrich` — the vocabulary the journal filters on | list · list.states | [SR7](../modules/operate/features/see-what-ran.md#decisions) | ✅ | ✅ |
| C6 | `MarkChip` | `ui-extended` | the micro-mark a row carries: `↺ 2 of 3` · `⏸ 1 of 3` · `↳ delegates` · `live` · `no answer` · `stopped` | in_order · in_order.states | a run-time mark, where `BoundChip` is a **declared** bound | ✅ | ✅ |
| C7 | `AttemptClock` | `ui-extended` | `queued · attempt 1 · attempt 2 · settled`, each with started · took · what happened; the timed-out attempt **struck in place**; `elapsed against working` on the side | step · step.states · step.exchange | [SR56](../modules/operate/features/see-what-ran.md#decisions) | ✅ | ✅ |
| C8 | `ArtifactTable` | `ui-extended` | `file · kind · size · digest · written` + `Open` · `Download`; the digest is the address, eight characters, mono; a purged file struck | step.touched · step.touched.write · step.states | [SR58](../modules/operate/features/see-what-ran.md#decisions) | ✅ | ✅ |
| C9 | `AbsenceNote` | `ui-extended` | *nobody recorded one* · *purged by retention* · *the step declared `read_only: true`* — three facts, none of them an empty table | step.touched · step.states · in_order.states | [SR34](../modules/operate/features/see-what-ran.md#decisions) · [SR59](../modules/operate/features/see-what-ran.md#decisions) · [O6](../modules/operate/spec.md) | ✅ | ✅ |
| C10 | `ExchangeRecord` | `ui-extended` | the settled ask: the question, the options with the chosen one marked, who answered and after how long | step.exchange | [SR55](../modules/operate/features/see-what-ran.md#decisions) — `ClarifyCard` stays the **live** ask | ✅ | ✅ |
| C11 | `RecordPager` | `ui-extended` | `‹ ›` with `step 7 of 9`, in the pagehead | 5 step boards | [SR54](../modules/operate/features/see-what-ran.md#decisions) | ✅ | ✅ |
| C13 | `ParticipantRow` | `ui-extended` | one participant the world allowed and what the run did with it: the address, the verdict (`touched` · `never touched` · `refused` · `miss`) and what came back. The striking is `AddressChip`'s, so no two surfaces disagree about whether a refusal is shown | detail.lens · step.touched | [SR53](../modules/operate/features/see-what-ran.md#decisions) — found while building D6: `LensRow` is a **world** in a drawer, and nothing drew a participant's verdict | ✅ | ✅ |
| C12 | `RunStatusText` | `ui-extended` | `succeeded · running · cannot_answer · awaiting_approval · queued · cancelled · failed`, each on its own token, as a cell and as a chip | list · list.states · every pagehead | the status vocabulary is the engine's; a per-call-site colour is how two screens disagree | ✅ | ✅ |

### 1.3 Update — what exists and needs more

| # | Component | Where | Change | Boards | Status |
|---|---|---|---|---|---|
| U1 | `LayerStrip` | `ui-extended` | **the forecast reading**: `p50` drawn **on** the bar with its Δ, band notes (`3 calls, all inside p95`), and a seam with **no estimate** — dashed, stating so beside its actual | layers · layers.forecast | ✅ |
| U2 | `DataTable` | `tables` | indent rows (a child run under its parent), row selection (accent + inset rule), cell readings — mono · tone · struck | list · list.states · step · step.touched* | ✅ |
| U3 | `@invana/tables` in Studio | `studio/` | **already a dependency, and already drawn with.** The row was written against a Studio that did not have it; it has, and had before this queue started — `studio/package.json` carries it and four surfaces render `DataTable`: the access-token table, the lifecycle dialog's open-work preview, and the agents' Pools and Ceilings tables. Nothing was installed to close this. What remains is not a dependency but a **screen** — the journal route that draws `list · step · step.touched*` — and that is [the-screens.md](../the-screens.md)'s row, not a component's | list · step · step.touched* | ✅ |
| U4 | `Legend` | `ui-extended` | swatch kinds `stripe` (the layer bar), `bracket` (a bounded repetition), `rule` (a gate). Today: dot · line · dashed · arrow · ring | in_order · layers · layers.forecast · flow | ✅ |
| U5 | `FilterChip` | `ui-extended` | closable (`since: today ×`), and the bar's own summary (`interactive runs hidden`) | list · list.states · every panel | ✅ |
| U7 | `RecordHeader` | `ui-extended` | **the last crumb gives way first.** Every parent crumb was truncating equally, so `runs › run:7d3184f1 › step:9b1c40e2 execute_query` rendered as `ru… › run:7d3184… › step:9b1c40e2 execute_qu…` — and the kind prefix is the one thing [SR54](../modules/operate/features/see-what-ran.md#decisions) says a crumb exists to carry. Found by rendering, not by type-check | every step board | ✅ |
| U6 | `TaskNode` | `ui-extended` | `readOnly` — a run's picked node gets the ring and **no handles**; handles belong to the draft canvas | flow · flow.step ([SR52](../modules/operate/features/see-what-ran.md#decisions)) | ✅ |

### 1.4 New — `@invana/dashboard` panel kinds

A run page is `board.kind = run` ([CV12](../modules/explore/features/boards.md)), so each band
reaches Studio as a panel spec, never a hand-composed page.

**They ship as `RUN_PANELS`, not as built-in kinds.** `BUILT_IN_PANELS` is eleven kinds that two
unrelated surfaces each need; these are one surface family's. A consumer draws a run with
`<Dashboard spec={spec} registry={RUN_PANELS} />`, so a product that only wanted tiles and a log does
not carry the run vocabulary — and a product that draws runs does not copy the adapter.

| # | Kind | Renders | Note | Status |
|---|---|---|---|---|
| D1 | `trace` | `TraceList` (C2) | the `In order` reading. Row select dispatches `stepId` on `ActionContext` | ✅ |
| D2 | `touched` | `TouchStrip` (C3) | the summary strip, not an axis | ✅ |
| D3 | `attempts` | `AttemptClock` (C7) | | ✅ |
| D4 | `artifacts` | `ArtifactTable` (C8) | | ✅ |
| D5 | `layers` | `LayerStrip` (U1) | `gantt` stays `TaskGantt`; both drawings are wanted | ✅ |
| D6 | `lens` | `LayerSection` + `LensRow` | both already ship; the panel kind is what is missing | ✅ |
| D7 | `clarification` | `ExchangeRecord` (C10) | **not** a change to the built-in `exchange`: that panel draws an exchange of *documents* (a request and a response, as code), and a settled ask is a question, its options and who chose. Two drawings, two kinds | ✅ |
| D8 | absent panels | `AbsenceNote` (C9) | a `Dashboard` rule, not a per-panel one: a record nobody wrote does not render; one retention purged says **purged** ([SR34](../modules/operate/features/see-what-ran.md#decisions)) | ✅ |

### 1.5 Not design-kit — the canvas repo

**None of the three is a component.** The canvas already draws flows as graph data — freeform node
structures, routed edges, edge badges, a feedback edge withheld from the layout — so what `Flow` and
`Flow · step` needed was a **recipe**, not new chrome in `canvas-ui`. One story proves all three:
`apps/storybook/stories/designs/RunFlow.stories.tsx` in the canvas repo (`Designs › Run flow`), beside
the four it joins.

| # | What | Where it landed | Status |
|---|---|---|---|
| X1 | `GateMarker` | **an `EdgeBadge`, not a node.** A gate is dispatched by nobody and holds no slot, so it cannot be a box in the chain: it is a condition *on the way into* a step, which is what a badge at `placement: 'middle'` on that edge says. The answer (`approved by ravi · waited 2m 04s`) rides above it as the edge's own label, so neither is read through the other | ✅ |
| X2 | read-only flow | **the absence of a behaviour.** `DragNodeBehaviour` is simply not mounted; pan, zoom and hover stay, because reading is not editing. The picked node's ring with no handles is `TaskNode readOnly` (U6) on the DOM side | ✅ |
| X3 | dashed, labelled loop-back edge | **already shipped.** `pathType: 'manhattan'` with a stub, `strokeDashArray`, a label and a counter badge — the same three marks `Designs › Iteration loop` uses. The round that went back is a feedback edge (`feedbackEdges`), so ELK routes it around the chain instead of reversing it | ✅ |

### 1.6 Build order

| # | Ships | Unlocks | Status |
|---|---|---|---|
| 1 | C1 · C4 · C5 · C12 · U2 · U5 | the journal and every pagehead — 16 boards' chrome | ✅ |
| 2 | C2 · C3 · C6 · U4 | `In order`, the default reading — 3 boards | ✅ |
| 3 | U1 | `Layers` and `Layers · forecast` — 2 boards | ✅ |
| 4 | C7 · C8 · C9 · C10 · C11 · U6 · U7 | the step's three readings, its two kinds and its six states — 5 boards | ✅ |
| 5 | D1–D8 · C13 | the run and step pages as specs rather than pages | ✅ |
| 6 | X1 · X2 · X3 | `Flow` and `Flow · step` — 2 boards | ✅ · all three were recipes over what the canvas already ships |

## 2. Where the queue stands

| | New | Update | Total |
|---|---|---|---|
| `@invana/ui` | 13 | 5 | 18 |
| `@invana/tables` | — | 2 | 2 |
| `@invana/dashboard` | 8 | — | 8 |
| the canvas repo | — | 3 recipes | 3 |
| **Shipped** | **21** | **9** | **31 of 31** |

**The queue is closed.** U3 was the last open row and it was already satisfied — `@invana/tables`
has been a Studio dependency since before this queue began, and four surfaces draw with it. What it
really pointed at is the journal **screen**, which is tracked in [the-screens.md](../the-screens.md).

## 3. Notes from the build

| # | What | Detail |
|---|---|---|
| N1 | **A panel spec's options are strings, never `ReactNode`** | `ArtifactSpec`, `ParticipantSpec` and `ClarificationOption` restate the component props in plain values. A dashboard is fetched, stored beside a plan and diffed; a `ReactNode` survives none of that. The components keep their `ReactNode` props — it is the *spec* that is narrow |
| N2 | **A `lens` section carries one of two readings** | `participants` is a **run's** lens — every address the world allowed, each with what this execution did with it ([SR53](../modules/operate/features/see-what-ran.md#decisions)). `rows` is a **world's** — the lenses that narrow a layer, as the Govern drawer reads them. One kind, two questions, and a section that gives both draws both |
| N3 | **`RunStatusText` reads `running` in the info token** | A dot says *in flight* with motion; a word cannot, and in most themes `primary` and `success` are near neighbours — so a status column that wrote both in the same green would say nothing at a glance. Beside a dot, the dot still pulses |
| N5 | **Absence is three-way, and the dashboard owns it** | `unrecorded` **drops the panel outright** — while a step is in flight there is no `result.json` box, and one reading *nothing recorded* would claim the step recorded nothing ([SR59](../modules/operate/features/see-what-ran.md#decisions)). `purged` keeps its band and says so ([O6](../modules/operate/spec.md)); `declared-none` keeps its band and says it in the contract's own words (`read_only: true`). A row whose panels all drop does not leave an empty gap |
| N6 | **None of this is released** | design-kit `v0.0.30` was cut and pushed from a clean `main` earlier today, and Studio pins `^0.0.30` — **this queue is not in it**. Everything above is uncommitted in the design-kit working tree; the components reach Studio only after a `./release.sh` cut ([design-kit release](design-kit-coverage.md)) |
| N4 | **Open: the linear clock crowds a run whose work is seconds** | On `Layers`, eight seconds of compute inside a three-minute run puts five bars at their floor width around one tick. It is the honest drawing — a bar's width *is* its duration — and `minTrackWidth` spreads it, but a run with a long human wait is still read better folded. The kit's own `where-the-time-went` story documents the same limit |
