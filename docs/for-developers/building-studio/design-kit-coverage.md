# Hi-fi board → design-kit coverage

Audit of the 43 artboards in `.design/hi-fi-finance/` against `@invana/design-kit`
(`~/Projects/invana/design-kit`), and the plan to rebuild the board on the kit.

- **Board**: 43 artboards, 1440×900, hand-written HTML + inline styles, ~112 distinct visual elements.
- **Kit**: `@invana/ui` (34 primitives + 17 extended + 16 typography), `@invana/forms`,
  `@invana/tables`, `@invana/themes` (3 app shells), `@invana/styling` (tokens), 232 stories.
- **Canvas**: `~/Projects/invana/canvas` — `@invana/canvas-ui` already peer-depends on
  `@invana/ui` + `@invana/forms` + `@invana/styling` + `@invana/themes` and ships the canvas
  pixels (toolbars, panels, menus, status bar, `GraphCanvasApp`), 58 stories.
- **Headline**: the *shell*, the *assistant thread* and the *canvas chrome* are already covered.
  The gap is the **answer surface**, **charts**, **compact density**, and about 20 small
  composites the board repeats on every screen.

### Status

The kit is done. design-kit `main` is at `0.0.23`, every package is on npm, and Studio pins
`^0.0.23`. The release gate that blocked everything downstream is gone — which is what made it
sensible to stop drawing a screen per slice and build all forty-two now (DS14).

| | |
|---|---|
| Done | Phases 0 · 1 · 2 · 3 · 4 · 5 in **design-kit** — foundations, shell, rows & sections, answer surface, charts, editors. Plus the **type ladder** (D7) and the `Themes/AppV2 › ExplorerShell` story that found it. Plus Studio's **A0** — the pin and the styling import |
| Not done, despite the ✅ on Phase 0 | the **board harness** (§5.1). `.design/board/` does not exist in this repo — Phase 0's ✅ covers the design-kit half only |
| Next | **A1** — delete Studio's parallel component layer (DS17). Then A2 · the shell, and on through §4a |

### Two tracks

| Track | Goal | Order |
|---|---|---|
| **A · Studio builds every screen** | All 42 artboards become real routes composed from `@invana/*`, each driving `AppLayoutV2`'s regions rather than a hand-built panel group ([DS12](../modules/platform/features/design-system.md) · [DS14](../modules/platform/features/design-system.md)). A screen ahead of its engine is 🖼, not ✅ (DS15) | **First, and it is now the whole job.** Studio is the only consumer that exercises the shell with a live canvas, a router and real state — it finds the gaps a static board never will |
| **B · The board** | The same 42 artboards on the board, for the screens Studio has built and as the reference for those it has not (§5) | After A3. The board copies a shell already proven in Studio — never the other way round |

`Themes/AppV2 › ExplorerShell` is the contract both tracks build against (DS16). It is a **layout
contract, not code to copy** — the mock data, `storageKey={null}` and `mainClassName:
h-[calc(100vh-63px)]` are story-only.

Two chores the type work surfaced and did not fix: `pnpm build` fails on `@invana/stoybook` with 24
`Could not resolve "@/components/ui/*"` errors — pre-existing on a clean tree, an app carrying a
`tsup` build it should not have; and both `under-development.tsx` files still use raw
`bg-yellow-100 text-yellow-800` against the tokens-only rule.

### The three repos

Dependency direction is one-way. A component goes to the lowest layer that can own it.

```
design-kit   @invana/styling → ui → forms/tables → themes      general kit
    ↓
canvas       canvas-core → canvas-store → canvas → graph
             canvas-react (headless) → canvas-ui (owns @invana/ui)   graph pixels
    ↓
invana       studio/ · .design/board/                          product + board
```

---

## 1. What the board is made of

### 1.1 The shell — identical on 36 of 43 artboards

| Region | Size | Contents |
|---|---|---|
| App header | h38 | wordmark · user · breadcrumb (`graph › section › object`) · token meter (`1.2k`) · icon actions · **Assistant** toggle (h24 tinted+bordered) |
| Left rail | w45 | icon buttons (p8, r2), active = tinted bg + primary fg, 1px separators, one carries a count badge (pill h14) |
| Left panel | w420 (w330 variants) | panel header h30 (breadcrumb **or** tab strip) · icon-button toolbar · filter-chip row · scroll body · footer action bar |
| Resize handle | w4 | grip (r, h16 w3) |
| Main / canvas | flex | canvas tab strip h30 (active tab filled) + actions · canvas surface · floating tool cluster (24×24 / 32×32) · legend card · caption strip |
| Assistant | w330 | header h30 `Ask Assistant › <title>` · thread · context chip · composer h34 · composer status bar h28 (agent name + `NL`) |
| Context bar | h28 | tabs · counters · keyboard hint (`⌘↵ accept`) |
| Status bar | h25 | state pill (`ACTIVE`/`DRAFT`/`RUNNING`/`REVIEW`) · counters · `v0.9.0` |

Seven artboards break the shell: `AssistantShell`, `AssistantList`, `AssistantThread`,
`AssistantInspector` (annotated mock frames), `RunOutcomesHiFi` (4 `rightSection`-width cards side by
side), `StoryIndexHiFi` (a grouped table), `CliHiFi` (terminal instead of a canvas).

### 1.2 Density — corrected after reading the kit

The first draft of this section said the kit ships shadcn defaults at a 14px base and that nothing
in the board matched it. **That was wrong**, and the correction shrinks the work considerably.

| | Board | design-kit, actually |
|---|---|---|
| Base font | 13px | **13px already** — `html, body { font-size: 13px }` in `styling/index.css` |
| Control heights | 20 · 22 · 24 · 26 · 28 · 30 · 32 | 32 (`sm`) · 36 (`default`) · 48 (`lg`) · 32 (`icon`) |
| Meta text | 12px | none — the gap |

So the kit is *already* dense. What is missing is one tier **below** `sm`, and a 12px meta step.
That is a `size="xs"` on the controls that need it, not a density axis — see D1.

**The type ladder.** Two content sizes, and the root is the only dial (D7, and the section on it
below). `text-base` is `1rem` — 13px in an application, 16px on a site that sets that root —
and `text-meta` is `0.923rem`, the one step under it. Nothing else is a content size; `lg` and up
are heading steps on Tailwind's defaults.

A component declares **no** font size: default text inherits the root, subordinate text says
`text-meta`. That is what lets one component set render both a dense application and a marketing
page — a hard-coded size can never be body copy.

`text-sm` and `text-xs` are compatibility aliases of `base` and `meta`, not rungs. They exist
because 300+ call sites in canvas and invana already mean exactly those two steps by them; they are
not there so new code has options.

### 1.3 Colour

| Board token | design-kit token | Status |
|---|---|---|
| `--bg` `--fg` `--card` `--muted` `--muted-fg` `--border` `--accent` | `--background` `--foreground` `--card` `--muted` `--muted-foreground` `--border` `--accent` | ✅ same set, different names |
| `--primary` `--primary-fg` `--secondary` `--secondary-fg` `--destructive` | same | ✅ |
| `--success` `--warning` `--info` | `--success` `--warning` `--info` (+ `-foreground`) | ✅ present in styling, **not surfaced on `Badge`** |
| `--edge` (graph edge) | — | ❌ missing |
| Node/edge-type categorical palette (Stock · Article · Observation · Learning · Pattern · Theme · Bar; MENTIONS · ABOUT · CITES · INSTANCE_OF · RATES · REFINES) | `--color-data-1…8` | ✅ shipped in `@invana/styling` (D2). Artboards read the tokens; no per-type `hsl()` |

Tints are done with `color-mix(in srgb, var(--success) 12%, transparent)` — a *soft* badge style
the kit does not have.

---

## 2. Coverage table — every visual element

Legend: ✅ use as-is · 🟡 exists but needs extending · ❌ build it.

### 2.1 Shell and layout

| # | Board element | design-kit | Status | Note |
|---|---|---|---|---|
| 1 | 4-region resizable app shell | `AppLayoutV2` (`@invana/themes`) | ✅ | `header`/`leftNav`/`leftSection`/`mainSection`/`rightSection`/`bottomSection`/`footer` maps 1:1 |
| 2 | App header | `NavHorizontal` | ✅ | `left`/`center`/`right` slots |
| 3 | Left rail | `NavVertical` | ✅ | item `badge` — a count pinned to a rail icon |
| 4 | Breadcrumb (truncating) | `Breadcrumb` | ✅ | |
| 5 | Panel header + body | `PanelContent`, `TabbedPanel` | ✅ | |
| 6 | Collapsible drawers in a panel (`Node types · Edge types · Links · Staged`) | `PanelStack` | ✅ | Shipped in the Model panel. `title` takes a node, so the count rides the header and reads while the drawer is closed; `headerActions` with `menuItems` replaces a hand-built dropdown. The breadcrumb this row used to name is `PanelCrumbs`, not `PanelStack` |
| 7 | Resize handle + grip | `Resizable` | ✅ | grip is a style detail |
| 8 | Scroll bodies | `ScrollArea` | ✅ | |
| 9 | Canvas tab strip h30 | `Tabs` / `TabbedPanel` | ✅ | `Tabs size="sm"` — 30px strip / 26px trigger, set once on `<Tabs>` via context |
| 10 | Context bar h28 (tabs + counts + kbd hint) | `ContextBar` | ✅ | 28px — view switch, the counts for the work in front of you, the shortcut that finishes it |
| 11 | Status bar h25 (state pill + counters + version) | `AppStatusBar` | ✅ | 25px, generalised from `ChatSessionStatusBar` (which stays, thread-scoped). canvas-ui's `GraphStatusBar` stays graph-scoped |
| 12 | Bottom footer action bar (Accept / Reject / Reassign) | `Button` + `ButtonGroup` | ✅ | |

### 2.2 Atoms

| # | Board element | design-kit | Status | Note |
|---|---|---|---|---|
| 13 | Status dot 5–14px (running/served/warning/failed/queued, pulsing) | `StatusDot` | ✅ | `ui/status-dot.tsx` — running is the only tone that animates |
| 14 | Outline chip (`active`, `staged`, `review`, `needs input`) | `Badge variant="outline"` | ✅ | |
| 15 | Soft tinted chip (success/warning/info `color-mix`) | `Badge` | ✅ | `variant="soft"` × `tone` (primary/success/warning/info/muted), mixed from `--badge-solid` at the point of use |
| 16 | Pill counter (rail badge, `7`) | `NavVertical` item `badge` | ✅ | the rail count is the nav item's own badge, not a `Badge` — the one place a rounded capsule is right |
| 17 | Mono token chip (`gap-continuation`, `setup-check@2`) | `InlineCode` / `Badge` | 🟡 | `InlineCode` covers it. `Badge` still has no `mono` — see the open list below |
| 18 | Icon button 24×24 / 32×32 (ghost + active) | `Button`, `ButtonWithTooltip` | ✅ | `size="xs"` / `"icon-xs"` — the 24px dense tier |
| 19 | Agent/person chip (icon + name, r, h22) | `AgentChip` | ✅ | agent vs person tone |
| 20 | Separator (1px vertical / horizontal) | `Separator` | ✅ | |
| 21 | Keyboard hint (`⌘↵`) | `Kbd` | ✅ | |
| 22 | Spinner / pulse | `Spinner` | ✅ | |
| 23 | Skeleton lines | `Skeleton` | ✅ | only in the annotated mocks |
| 24 | Progress / budget bar (h4 track + fill) | `Progress` | ✅ | needs `h4` size |
| 25 | Dot rating (weight 1–3) | `DotRating` | ✅ | ships beside `RatingControl` in `ui-extended/rating-control.tsx` — one caller, so co-located until a second appears |
| 26 | Wave / order badge (mono circle 18×18) | `Badge` | 🟡 | no `shape="circle"` — see the open list below |
| 27 | Superscript citation marker (`¹˒²`) | `CitationMarker` | ✅ | exported from `ui-extended/emission-card.tsx` — it is the `prose` body's superscript |
| 28 | Token meter (icon + `1.2k`) | — | 🟡 | app-side today: a span with an icon and a number. See the open list below |

### 2.3 Rows, lists, sections

| # | Board element | design-kit | Status | Note |
|---|---|---|---|---|
| 29 | **Entity row** — dot/avatar · title + inline badges · subtitle · trailing badges/actions · selected · nested (`└`) | `Item` | ✅ | `size="xs"` + `selected`; no new component (Q1) |
| 30 | **Step row** — dot · step name · detail · duration | `ChatSessionTaskRow` | ✅ | exact match — the board calls it `StepList` |
| 31 | Step group + disclosure (`Todo for 9.8s · 11 of 11 steps ▾`) | `ChatSessionDisclosure`, `ChatSessionTaskGroup` | ✅ | |
| 32 | Sub-step elbow line (`└ Risk Checker · verdict pass`) | `ChatSessionActivitySubLine` | ✅ | |
| 33 | Key/value row (label w78 + value) | `PropertyList` + `PropertyRow` | ✅ | promoted down out of canvas-ui into `@invana/ui` |
| 34 | Section header h35 (icon + title + count + `+ add`) | `SectionHeader` | ✅ | icon + title + count + actions slot |
| 35 | Filter-chip bar (`kind ▾ status ▾ … │ 8 datasets`) | `FilterBar` | ✅ |  |
| 36 | Search input | `SearchInput` | ✅ | |
| 37 | Layers tree (indent · eye toggle · swatch · label · count) | `LayersViewPanel` (canvas-ui) | ✅ | **not a design-kit gap** — canvas-ui ships it with the native visibility API (`store.isNodeHidden`/`isEdgeHidden`). Studio's hide/show workaround can be dropped on the next canvas bump |
| 38 | Timeline / history entry (date · rich body) | `TimelineList` | ✅ |  |
| 39 | Citation row (kind badge · text · source) | `CitationList` | ✅ |  |
| 40 | Diff list (`+ node Pattern`, `+HINDPETRO / −INFY`) | `DiffList` | ✅ |  |
| 41 | Empty / locked state (icon card · title · body · locked chips) | `EmptyState` | ✅ | generalised; `UnderDevelopment` stays for its own case |

### 2.4 Data display

| # | Board element | design-kit | Status | Note |
|---|---|---|---|---|
| 42 | Compact table (th h26–28, td, mono cells) | `Table`, `DataTable` | ✅ | `density="compact"` — one prop on the table; a table with two densities in it is always a mistake |
| 43 | Grouped table with group header rows (`StoryIndexHiFi`) | `DataTable` | ✅ | `groupBy` + `renderGroupHeader` |
| 44 | Metric tile (label · big value · caption) + grid | `MetricTile` / `MetricGrid` | ✅ |  |
| 45 | Horizontal bar rows (label · track · bar · value) | `BarChartH` | ✅ | SVG/CSS only, token-driven (D4) |
| 46 | Column chart with gridlines + axis (`accepted per week`) | `BarChartV` | ✅ | SVG/CSS only, token-driven (D4) |
| 47 | Diverging bar (± around a baseline, `net learning weight`) | `DivergingBar` | ✅ | SVG/CSS only, token-driven (D4) |
| 48 | Firing heat strip (21× 14px state squares + hour axis + legend) | `HeatStrip` | ✅ | SVG/CSS only, token-driven (D4) |
| 49 | Legend (dot/line swatch + label rows) | `Legend` + `LegendItem` | ✅ | dot · line · dashed · arrow · ring swatches — a dashed arrow needs a dashed arrow in the legend |
| 50 | Canvas caption strip | `CanvasMessageBar` (canvas-ui) | ✅ | |
| 51 | Canvas tool cluster (icon stack overlay) | `CanvasControlsToolbar` (canvas-ui) | ✅ | |
| 52 | Subgraph preview card (thumb · `9 nodes · 12 edges` · Show) | `exportSVG` + `Card` | ❌ | `SubgraphPreview` — the card wrapper is still unbuilt. Phase 6 |

### 2.5 The answer surface — was the biggest gap, now shipped

Every artboard with an Assistant renders answers as **emissions**. This is Invana's core
surface and none of it exists in the kit.

| # | Board element | Status | Shape |
|---|---|---|---|
| 53 | `EmissionCard` | ✅ | header strip + body slot. `EmissionHeader` is exported separately so a task result or a scheduled answer shows the *same* header rather than inventing one that drifts |
| 54 | Emission kinds | ✅ | takes a kind, a template name and children — never a domain object (DS6). An absent citation strip means *not applicable*; nothing to cite says `0 records`, so a missing strip never reads as an uncited claim |
| 55 | `CannotAnswerCard` | ✅ | dashed, no citation strip, names what would change it |
| 56 | `DiagnosisCard` | ✅ | with `RepairNote` + `RetryNote` — four components, no shared variant prop (DS8): repair and retry render *on the step*, cannot-answer and diagnosis are cards |
| 57 | `ClarifyCard` | ✅ | parked, not failed. Options are measures the model declares, never generated — hence `detail` on every option and the footnote |
| 58 | `TemplatePicker` | ✅ | unavailable options are listed with their reason, not hidden; re-renders from records in hand, so the query does not run again |
| 59 | `ProposalCard` | ✅ | draft and evidence together, so the decision is made against instances. `consequence` states what authoring will write |
| 60 | `RatingControl` | ✅ | one control with two positions, not two buttons; states its consequence (`by`, `refines`) |
| 61 | `ChatSessionContextChip` | ✅ | fills the composer's `attachments` slot — what is bound is the surface's business, not the composer's |
| 62 | Prompt row / message / composer / status bar / progress line | ✅ | `ChatSession*` — a near-exact match |

### 2.6 Forms, dialogs, editors

| # | Board element | design-kit | Status | Note |
|---|---|---|---|---|
| 63 | Labelled fields (input, select w/ caret, textarea, checkbox, password) | `@invana/forms` | ✅ | `inputSize="sm"` / `triggerSize` — the 26px application field on `Input`, `Textarea`, `SelectTrigger` |
| 64 | Two-column field grid | `FormField.ObjectField` + `rowConfig` | ✅ | |
| 65 | Accordion setting groups (`Info 3 saved`, `Connection 5 tested`) | `Accordion` | ✅ | **no change needed** — `justify-between` with the chevron last already takes a count and a status badge. `section-counts` story added so nobody adds a `count` prop |
| 66 | Confirm dialog (title · body · impact list · actions · `esc cancels`) | `AlertDialog` | ✅ | |
| 67 | Property/schema editor table (`Property · Type · Rules` + `+ add property`) | `DataTable` + `EditableCell` | ✅ | `density="compact"` |
| 68 | Markdown rules/skill editor block (mono, bordered, inline highlight + version badge) | `@invana/editor` | ✅ | `MarkdownEditorBlock` — its own package, because CodeMirror 6 must stay out of `@invana/ui`'s graph (D6) |
| 69 | Syntax-highlighted code block (Airflow DAG) | `@invana/editor` | ✅ | `CodeBlock` — same package as #68 |
| 70 | Terminal / CLI transcript (`$` prompt, `→` output, columns, cursor) | `Terminal` | ✅ |  |
| 71 | Toasts | `Sonner` | ✅ | |
| 72 | Tooltip · Popover · HoverCard · Sheet · Command · DropdownMenu · Menubar · Carousel · Pagination | all present | ✅ | |

---

### 2.7 What is left — four rows, and one is a build

The table above was the original audit. Phases 0–5 closed all of it but these; each was
re-verified against the kit's source, not assumed.

| # | Element | Verdict |
|---|---|---|
| 53 | `TaskGantt` — one row per Task on a run's clock: a bar placed by start and width by duration, a red segment for a failed attempt, an outline for a task that never ran, an optional line of log under each row | **Shipped and installed — `@invana/ui@0.0.25` › `ui-extended/task-gantt`, with three stories** (`InFlight`, `Finished`, `CustomDetail`). Studio renders it in the **Runs** drawer's `Performance` band, fed from the run's own trace: `taskKey` · `status` · `startedAt` · `finishedAt` map straight onto it, `detail` is the row's line of log and `output` its `result`. It takes the trace's own shape (`task_key` · `status` · `started_at` · `finished_at` · `duration_ms`) as `startMs`/`durationMs` or as timestamps with an `origin`; `attempts` are the retry segments, `result` · `error` · `summary` · `log` fill the **hover card** (`TaskGanttDetailCard`, exported; `task.detail` replaces one row's body, `renderDetail` every row's — [SR22](../modules/operate/features/see-what-ran.md)), `density` · `labelWidth` serve the three surfaces ([SR14](../modules/operate/features/see-what-ran.md)), `nowMs` + `openEnded` are the live run, and `onSelectTask` is what filters the log ([SR15](../modules/operate/features/see-what-ran.md)) |
| 54 | `PanelStack` — a stack of collapsible, resizable drawers, driven from outside | **Shipped — `@invana/ui` › `ui-extended/panel-stack`, with the `DrivenFromOutside` story.** `stackRef` (`expand` · `collapse` · `toggle` · `isCollapsed`) and `onCollapsedChange` were added for the Tasks and Projects stacks: a drill-in has to open its own drawer, or the detail renders into a section the reader collapsed. Deliberately **not** a `collapsed` prop — the resizable group owns the geometry, and a controlled map would fight every drag ([G35](graph-detail-page.md)) |
| 55 | `PanelStackHandle.collapseOthers(id)` — shut every sibling of one section, **atomically** | **Owed.** The *Library › Plans* artboards draw a drilled-in record with its two siblings collapsed to their headers, and the handle cannot express it: `collapse()` hands a section's freed height to the next neighbour, so a loop over two siblings always leaves one of them open — the same hazard `PanelStack` already solves atomically for `defaultCollapsed` at mount, and its own comment says so. Until the kit has it, the Library stack keeps [G35](graph-detail-page.md)'s split and a plan's record scrolls in a 60% drawer, which is legible but is not what the board draws |
| 57 | **Four class names, two rungs — and `text-sm` is not small.** Retire `--text-meta`; make `sm` and `xs` mean what everyone reads them to mean | **Agreed, and it costs no pixels.** Measured in the running app: `text-base` 13px · `text-sm` **13px** · `text-meta` 12px · `text-xs` **12px**. `sm` is an alias of `base` and `xs` an alias of `meta`, so the ladder reads as four choices and is two — which is the whole of *the sizes look inconsistent*. The scale becomes `base 1rem` (13px) · `sm 0.923rem` (12px) · `xs 0.846rem` (11px), and `--text-meta` is deleted. **The migration is a 1:1 rename, not a re-baseline**: `text-sm → text-base` (690 sites, both 13px), then `text-meta → text-sm` and `text-xs → text-sm` (721 sites, both 12px). Nothing moves; afterwards `xs` is a real third rung for the 10.5px band the artboards use, which the kit could not express before. It also deletes the `extendTailwindMerge` `font-size` group in `@invana/ui`'s `cn` — that exists **only** to register `meta`, and with it goes the footgun where an unregistered `text-*` size is read as a colour and silently drops the colour class before it. Counts: design-kit 433/259/180, canvas 29/8/71, Studio 228/128/75 (`sm`/`meta`/`xs`) |
| 56 | `PropertyRow mono` — the face, or the face **and** a type step? | **Owed, as a question for the kit.** `mono` sets `font-mono text-meta`, so a property list whose values are mixed renders the mono ones a step under the plain ones and reads as two lists. `prow` on the artboards sets the mono face and leaves the size alone — the label is the subordinate half, a value is a value. The plan panel therefore writes `font-mono` on the value span and does not pass `mono`; if the kit agrees, `mono` should drop the step and the call sites that wanted both should ask for both |
| 52 | `SubgraphPreview` — thumb · `9 nodes · 12 edges` · Show | **Build it, in Phase 6.** `exportSVG` already exists in canvas's `@invana/graph`; what is missing is the card around it. It belongs with the rest of the canvas wiring, not before it |
| 28 | `TokenMeter` — icon + `1.2k` | **No.** It is a span with an icon and a number, it appears once (the app header), and the original audit already hedged "or app-side". A component here is machinery around a `<span>` |
| 26 | `Badge shape="circle"` — wave/order badge, mono 18×18 | **Only if the board still draws it.** One artboard family used it; if it survives Phase 7, it is a `shape` variant and half an hour. If it does not, delete the row |
| 17 | `Badge` mono variant | **No — `InlineCode` is the answer.** A mono chip and inline code are the same object; giving `Badge` a `mono` would make two ways to do one thing, and the kit would then have to say which |

---

### 2.8 The Tasks dashboards — `mainSection` for a TaskRun and a Task

The six artboards on page 4 of the [*The Tasks Panel* canvas](https://claude.ai/artifact/9sAby5rPvkjMLb9BcdCom4)
— [34k–34p](../the-screens.md) — are **one `mainSection` shell drawn six times**. Everything below
was read off the rendered artboards, not off the source.

| Artboard | Record it draws | What changes |
|---|---|---|
| `RunDash` (34k) | the root **TaskRun** | six tiles, the flow with status painted on, Performance + Reported, Input + `result.json`, Log |
| `StepImport` · `StepQuery` · `StepLlm` (34l–n) | a **child TaskRun** — one Task's execution ([§0](../../orchestration.md), no separate step table) | **only the Output panel.** Tiles, Input, `result.json`, Artifacts, Where it sits and Log are identical |
| `PlanDash` (34o) | a published **TaskPlan** version | the same flow, painted with per-task medians instead of status; Arguments + Runs of this plan replace Input + `result.json` |
| `PlanStepParams` (34p) | one **Task** inside a draft | the flow with one node selected, then Parameters + its contract + Validation |

**The shell, top to bottom** — identical on all six: canvas tab strip → record strip → a scrolling
body of `gap-3` bands, each band a row of panels, some rows carrying a fixed 340px right column.

#### The inventory

Legend: ✅ use as-is · 🟡 exists but needs extending · ❌ build it.

| # | Element on the artboard | Home | Status | Note |
|---|---|---|---|---|
| 73 | Canvas tab strip + right tool cluster | `BoardPagesViewPanel` (canvas-ui) | ✅ | already the shell's `mainSection` ([the-shell.md](the-shell.md)); a dashboard is one more open page |
| 74 | **Record strip** — status dot · mono breadcrumb (`run › task`) · chips · prev/next · view switch · actions | `RecordHeader` (`ui-extended`) | ✅ | the one new piece of chrome. All six draw it; `strip()` in the canvas source. Slots: `dot` · `crumbs` · `chips` · `actions`. Not `ContextBar` — that is 28px of counters under a panel, this is a 40px record identity above one | — **shipped**, `ui-extended/record-header`, with the `Default` story (a run, a step, a draft).
| 75 | **Panel box** — bordered card, 31px header bar + right slot, body padded or flush | `PanelBox` (`ui-extended`) | ✅ | **~20 instances across the six artboards.** Not `PanelContent`: that fills its parent’s height, owns its own `overflow-y-auto` body, hardcodes `border-none`, and types its right slot as `NavHorizontalItem[]` (icon buttons) — a band is content-height, must not nest a second scroller, is a border box, and puts *text* on the right. `PanelBox` is thin: `Card` + a 31px bar built from **`Eyebrow`** (already uppercase-muted, already has `aside` for the right slot) + `CardContent`, with `flush` for the flow and the rows table. `SectionHeader` is left alone — it documents itself as *not* a card header, carries a rule instead of a box, and titles a section of a scrolling panel rather than a band of a dashboard | — **shipped**, `ui-extended/panel-box`, with the `Default` story.
| 76 | Tile — label · big mono value · caption, tinted value, 4px meter | `MetricTile` | ✅ | add `tone` (the value ink — `running` is `--info`, `ok` is `--success`) and `meter` (`value`/`max`, the 4px bar under the caption). `MetricGrid` already lays the strip out | — **shipped**: `tone` and `meter` are on `MetricTile`, with the `WithMeter` story drawing a run's six tiles.
| 77 | **The flow** — grid ground, task nodes, orthogonal edges with arrowheads, a dashed *when* edge, a dimmed never-ran node, a gate ring, selection handles | `@invana/canvas` + `TaskFlowCanvas` (canvas-ui) | ❌ | Track B. elkjs layered layout already ships (`@invana/graph-layout-elkjs`); what is missing is the **view**: a read-only, non-panning flow scaled to its band. Three renderings of one component — a run paints status, a plan paints medians, a draft paints handles ([G34](graph-detail-page.md)) |
| 78 | **Task node** — status dot · mono `step_key` · bound swatch + name · tag chips (`3 lanes`, `attempt 2`) · meta line | `TaskNode` (`@invana/ui`) | ✅ | **shipped**, `ui-extended/task-node`. Lives in `@invana/ui`, **not canvas-ui**: nothing about the card is bound to canvas state — no position, no camera, no store — so it belongs in the lowest layer that can own it, and whatever lays a flow out places these. Ring tones: selected `--primary` · gate `--warning` · failed `--destructive`; `selected` also draws the four corner handles |
| 79 | **Bound chip** — coloured square + mono bound name (`ingest` · `network` · `none` · `work_write` · `llm` · `graph_read`) | `BoundChip` (`ui-extended`) | ✅ | a closed six-value vocabulary with a colour each ([orchestration §0.6](../../orchestration.md)); it appears in the node, in the record strip and in the catalogue. Not a `Badge` variant — the swatch is the point | — **shipped**, `ui-extended/bound-chip`, with the `Default` story listing all nine.
| 80 | Key/value rows (Input, Where it sits, Arguments, Reported, the contract) | `PropertyList` + `PropertyRow` | ✅ | `labelWidth` — the artboards use 108px |
| 81 | `result.json` block — syntax-coloured, scrollable, height-capped | `CodeBlock` (`@invana/editor`) | ✅ | add `json` to `CodeLanguage`, and a `maxHeight`. It is read-only rendering, not an editor | — **shipped**: `json` is in `CodeLanguage` and `maxHeight` caps the block, the scroller inside CodeMirror rather than on the wrapper. `ResultJson` story.
| 82 | Log lines — `time · LEVEL · task · message`, level-coloured, truncating | `Terminal` + `TerminalLine` | ✅ | `columns` + `columnTemplate` already carry the four columns; add a **level tone** (`INFO`/`WARN`/`ERROR`) next to `kind`. Same component the drawer's Log band uses ([§3b](graph-detail-page.md)) — one log, three widths | — **shipped**: `level` tints one cell, named by `levelColumn` (default `1`, because a log reads `time · LEVEL · source · message`). Setting it drops the `kind` marker. `RunLog` story.
| 83 | Performance band | `TaskGantt` | ✅ | shipped, `@invana/ui@0.0.25`. `density` + `labelWidth` serve the 420px drawer and the wide dashboard from one component |
| 84 | Output · rows table | `DataTable density="compact"` | ✅ | inside a `PanelBox pad={false}` so the header rule meets the panel border |
| 85 | Artifact row — upload icon · mono filename · meta · `input`/`output` badge | `Item` + `ItemMedia`/`ItemContent`/`ItemActions` | ✅ | no new component; the row is exactly what `Item` is for |
| 86 | Runs-of-this-plan row — status dot · label · duration | `Item` + `StatusDot` | ✅ | |
| 87 | Output · graph sample — grid thumbnail of written nodes, `sample · 2,408 written ›` | `SubgraphPreview` | ❌ | **already row 52** — the same unbuilt card. This artboard is its second caller, which settles that it is built in Phase 6 rather than dropped |
| 88 | Output · the exchange — `PROMPT`/`COMPLETION` label over a bordered mono block | `Eyebrow` + `CodeBlock` | ✅ | |
| 89 | View switch — `Dashboard` ⁄ `dashboard.yml` ⁄ `plan.yml` | `ToggleGroup` | ✅ | |
| 90 | Prev/next task arrows | `Button variant="ghost"` + `ButtonGroup` | ✅ | |
| 91 | **Parameter row** (34p) — mono label + type caption, a source `Select` (`binding` · `argument` · `literal`) joined to the value input, a note or error line under it | `ParamRow` (`@invana/forms`) | ✅ | `InputGroup` + `InputGroupAddon` + `Select` is the composition; the row owns the label/type/note grid. The form is **generated from the catalogue contract**, so the row takes a field descriptor, not children | — **shipped**, `@invana/forms` › `param-row`, with the `Default` story (a valid row, an invalid binding, a disabled `when`).
| 92 | Validation note — `legal` badge + a sentence | `Alert` | ✅ | |
| 93 | Draft footer — sentence + Save/Revert/Publish | `Card` + `ButtonGroup` | ✅ | |

#### The assembler

The six artboards are one layout repeated, so Studio does not build six screens — it renders one
component from six documents. **[`@invana/dashboard`](https://github.com/invana/design-kit)** ships
that component.

| | |
|---|---|
| Input | a `DashboardSpec` — `header` + `rows[]` of `panels[]`. JSON, end to end |
| Built-in kinds | `metrics` · `properties` · `json` · `code` · `exchange` · `gantt` · `table` · `log` · `list` · `params` · `text` — eleven, covering every band in 34k–34p except the flow |
| Chrome | `title` is what puts a panel in a `PanelBox`; without one it renders bare, which is how the tile strip sits directly on the dashboard. `flush` drops the padding so a table meets the border |
| Behaviour | **not in the spec.** Actions carry an `id`; a Gantt row's selection, a list row's click and a parameter edit all return through one `onAction(id, ctx)` |
| Scrolling | the dashboard body scrolls and no band does — `PanelBox` is content-height by construction |
| `@invana/canvas` | arrives as a **registry entry**, never an import: `registry={{ canvas: Panel }}` with `DashboardSpec<{ canvas: CanvasOptions }>`. PixiJS stays out of every consumer that only wanted tiles and a log |
| Wiring | a consumer **must** add `@source "…/@invana/dashboard/dist/**/*.js"` to its Tailwind entry. Without it the classes only this package uses are never generated, and the page renders mostly-right with a few rules silently missing — which looks exactly like a specificity bug and is not one |
| Typing | the spec is parametrised by its registry. A `kind: string` catch-all checks **nothing** — a union with one permissive member accepts every object, and a `gantt` panel full of invalid statuses compiled and rendered empty tracks before this was fixed. `AnyDashboardSpec` covers a spec off the wire |

This is what closes 34l–34n: a step dashboard is a document, and the three differ only in their
`Output` panel — which is a different `kind` and a different `options`, not a different screen.

#### What this adds up to

| | |
|---|---|
| ✅ **Shipped in design-kit** | **9** — `PanelBox`, `RecordHeader`, `BoundChip`, `TaskNode`, `ParamRow` (`@invana/forms`), plus `MetricTile`'s `tone`/`meter`, `CodeBlock`'s `json`/`maxHeight`, `Terminal`'s `level` — and `@invana/dashboard`, a new package |
| ❌ Build in canvas-ui (Track B) | **1** — `TaskFlowCanvas`. `TaskNode` no longer waits on it |
| ❌ Already owed | **1** — `SubgraphPreview` (row 52, Phase 6) |
| ✅ Used as-is | **11** — `BoardPagesViewPanel`, `PropertyList`, `TaskGantt`, `DataTable`, `Item`, `StatusDot`, `Badge`, `ToggleGroup`, `Button`/`ButtonGroup`, `Alert`, `Eyebrow`, `Card` |

**What is left.** 34l–34n are buildable now — none of them draws the flow, and the dashboard renders
all three from documents. 34k, 34o and 34p need `TaskFlowCanvas`, which is Track B
([canvas-ui-coverage §5](canvas-ui-coverage.md)) and reaches Studio only on the next canvas release;
until it does, those three render with the flow panel absent rather than not at all.

---

## 3. What must be built in design-kit

### Phase 4 · charts — **built, but TODO** (design-kit)

> **Status: provisional.** The code is written, validated and rendering, but the
> chart set is *not* accepted. Charts were the one group deferred on purpose,
> because they carry a real design question rather than a markup question: which
> forms this product actually needs, at what sizes, and how much a 330px `rightSection`
> can carry. Every file carries a `TODO` saying so. Treat the APIs as unsettled
> until a board screen uses one in anger — and expect the form inventory, not
> the implementation, to be what changes.

Palette re-validated against design-kit's **actual** surfaces before any chart
code (`#ffffff` light, `#222528` dark), not the dataviz skill's defaults: all
checks pass both modes, with the documented light-mode contrast WARN on aqua,
yellow and magenta. That WARN obligates visible labels — every chart below
directly labels its marks, which is how it is discharged.

| What | Note |
|---|---|
| `BarChartH` | magnitude, horizontal because the labels are words. Single series, so no legend — `caption` names it |
| `BarChartV` | one measure over periods. `labelMode` defaults to `last`: a number on every column stops being a label and becomes texture, so gridlines carry the rest |
| `DivergingBar` | polarity around a real zero. Uses **status** colours, because its two directions are good and bad rather than two categories — the one place status colour belongs on a chart. One aligned value gutter, not one per side |
| `HeatStrip` | a run of firings. Status again, so the legend is **mandatory**: a square carries no label, and without it the strip would be colour-alone |
| `Sparkline` | 2px line, ≥8px end marker with a 2px surface ring. No axis: if a reader needs to read a value off it, it wanted to be a chart |
| `DataTable` `groupBy` / `renderGroupHeader` | presentational grouping — deliberately *not* TanStack's aggregating model. It sorts nothing and aggregates nothing, so it cannot disagree with the order the caller chose |
| **`useCodeMirror` rebuilt on a Compartment** | the one real defect shipped earlier. Keying the mount effect on `extensions` identity meant an inline array rebuilt the editor every render, losing cursor, selection and focus mid-keystroke. "Callers are expected to memoise" is a trap, not a contract — the view now mounts once and reconfigures in place |
| 2 stories | |

### Shipped — Govern K1–K11 (design-kit, uncommitted)

Every component the Govern and Agents panels need. Table with props:
[govern-and-agents-panels.md § 3](govern-and-agents-panels.md), where all eleven rows are now ✅.

| What | Note |
|---|---|
| `LayerChip` (K1) | six layers, one fixed hue each, the name always present. See the palette decision below |
| `AddressChip` (K2) | **truncates in the middle** — the last segment is *which thing* and the ones before it are *which kind*, and the kind is usually already on the `LayerChip` beside it, so the kind is what gives way. A plain `truncate` renders every model in a Graph as `graph_data/model/…`. `denied` and `refused` are separate tones: one is what the rule says, the other is what happened when a run reached for it |
| `RuleRow` (K3) | a rule as a sentence, selectors and egress as sub-lines that hang under the match rather than becoming columns most rules leave empty. Deny takes the destructive token, because deny wins at any specificity and *what is shut* must be findable without reading every row |
| `LayerSection` (K4) | a layer's band, with the summary line that states a **closed** layer. A band with no rules still appears — *no third parties configured* and *this lens admits none* are different facts |
| `LensRow` (K5) | a world in the drawer: name, what it narrows as six fixed kinds of chip, and usage. Usage **never sorts the list** — a world used once may be the one that matters, and a list that reorders under you cannot be scanned twice |
| `LensChip` (K6) | reads **`Everything`** when no lens is set — never blank, never `None`. The widest state is the default and it is a *state*, not a missing value; `None` would say nothing is in view, the opposite of what is true |
| `CastTable` (K7) | `role → resolves to → why this one`, **all four rows always**, including the ones nothing casts — that is the state that falls to a shipped default which may name a model the Graph is not credentialed for. A denied row names the rule, because the recourse is to edit that rule |
| `SliceSummary` (K8) | owns the slice vocabulary; the axis is always named. An **undeclared axis renders struck rather than dropped**, so the save-time refusal does not arrive from nowhere |
| `MatchPreview` (K9) | what a pattern bites right now. **Near-misses are greyed, not filtered** — a list of hits alone cannot distinguish *precise* from *wrong*, and seeing the four models `Deals@1.0.0` passed over is what tells an author to write `Deals@*` |
| `EgressList` (K10) | per destination, what may be sent and what was **cut**. `cut` is what makes it evidence rather than configuration: without it a rule that did work looks like a rule that never bit |
| `LayerStrip` (K11) | **a gantt: time across, the participants it spends down** ([D20](../governance.md)). Six bands, each opening into its own `parts` — `role: decide`, `model/Orders@v2`, `third_party/app/email` — and a task is a **bar** on the row it spends, carrying its own name. `scale="seq"` reads a plan's order, `scale="elapsed"` a run's wall clock, so one component serves both tenses. **Every band with participants folds**, and its tasks come onto its own line ([D21](../governance.md)) — shut, the strip is six lines and the whole plan is one picture; `collapse all` sits in the header. **Each task carries a hover card** (`hoverDetail` · `itemDetail`) with the participant, the span and the rule that refused it, so a bar never grows a second line per fact. **Refusals struck in place** — a gap is indistinguishable from a stretch of time that never reached for that layer, and *the bound bit here* is the most important thing the drawing says. `skipped` is a third state. **A row nothing spent is muted, never dropped** ([D22](../governance.md)) — the band recedes with its chip and its note, and so does a participant row under an open band, so *declared and never reached* stays readable as a finding; a row whose only task was **refused** keeps its full weight, because the mute follows *nothing happened here* and not *something was denied here*. **A gate is a seam, never a row** ([LB28](../modules/workflows/features/the-library.md#decisions)) — `seams` draws a rule at a position on the axis, crossing every band, with its label hung off the side the cost falls on (`edge: "before"` and nothing is spent; `"after"` and the pass is already paid for). `conditional` is dashed — it lives on the envelope and resolves at dispatch — and a seam with no `at` has no position at all: it runs the whole axis on its own line. **`brackets` pack into lines**, widest on top, so a nested repetition reads as nested. DOM over a fixed track, in `ui-extended` not `canvas-ui`, per § 3 |
| 17 stories | one exported story per file, under `stories/ui/ui-extended/`. `LayerStrip` has **seven**, because one component with two tenses, two readings, a bound and a gate is not shown by one. Three draw the component: `default` (declared), `touched` (a run) and `collapsed` (every band shut). Three draw **one run under two lenses**, off a shared `_run.ts` fixture — `run-execution` is the attended run, three `ask · clarify · read` rounds bracketed over the stretch each owns and the fourth ask struck by `human/** · max_rounds 3`; `where-the-time-went` is the same run folded, where `human` fills the middle of the axis and the machine layers are marks; `unattended` is the same plan under `may_ask: false`, refused before dispatch and answered in 47s against 9m 09s. **The pair is how the strip prices a person in the loop**: *waiting on a person* is read off the axis rather than from a total, and the cost is stated — at nine minutes of axis nothing under ~50s is measurable by eye, so the fixture is scaled for the wait and the card carries the rest. `gated` is the seventh: `settle-invoice@4` under three gates at once — an approval on the plan, an envelope gate dashed beside it, and a budget exhaustion with no position — which is the one picture that tells an approval from a verdict without a legend |

**The palette decision § 3 left open.** It says `LayerChip` takes the data slots `BoundChip`
left — but that is four free slots (`data-1 · 3 · 6 · 8`) against six layers. Two are therefore
deliberate: `llm` takes `data-7`, the slot `BoundChip` gives the **llm bound**, because two hues
for one idea is the confusion worth avoiding; and `agent` takes `muted-foreground`, because the
spine is never governed and must not read as a bound somebody could set — the same token
`BoundChip` spends on `none`, for the same reason.

**Three defects only rendering found.** All three shipped green through type-check, build and
Storybook's own build, and all three were wrong on screen — the third only once a *consumer* drew
them, which Storybook by construction cannot catch:

| Where | What was wrong |
|---|---|
| `AddressChip` | The head did not truncate, it **vanished** — `graph_data/stitch/route_airport@departs_from` printed as `route_airport@departs_from`, with no ellipsis and no signal anything was cut. A `truncate` head with `min-w-0` collapses to zero width once the tail fills the row, and `text-overflow` then has no room to draw its marker. The floor is now `2ch` with `shrink-[999]`: exactly one character plus the ellipsis, because at `1ch` the browser keeps the raw character and drops the marker — `groute_airport@…`, a word that was never in the address |
| `CastTable` | A row with a resolved address still read *shipped default — nothing casts it*, which contradicts itself. The suffix now belongs only to the row that has no address **and** no shipped default — the one state that says a run may open on a model this Graph never chose |
| `LayerChip`, **in Studio only** | Every swatch rendered transparent, so six layers whose whole point is to be told apart at a glance were six identical grey labels. Nothing was wrong with the component: its swatch is `bg-data-1`…`bg-data-8`, and Studio was not loading the data palette at all — the `@import` sat commented behind a `TODO` naming `@invana/styling` 0.0.21, and Studio has been on 0.0.28 for some time. Uncommenting it fixed five of eight slots; the other three stayed empty because the palette's light half is an `@theme` block, Tailwind 4 emits a theme variable only where it sees a utility reading it, and the `bg-data-*` classes live in `@invana/ui`'s **precompiled** CSS, which Tailwind does not scan. `@source inline("bg-data-{1,…,8}")` in `studio/src/index.css` names the whole scale in one place |

Two lessons for the rest of the Govern build. A component whose contract is *what survives when
there is not enough room* cannot be signed off by a green build. And a component whose contract
depends on a **token the consumer must load** is not proved by its story: Storybook imports the kit's
own CSS, so the palette was always there — the first drawing that could fail was the one in Studio.

**`SliceSummary` owns the slice vocabulary, and `RuleRow` renders it.** `RuleSelect`,
`DeclaredAxes` and `describeSlice` live in `slice-summary.tsx`; `RuleRow`'s select sub-line *is*
`<SliceSummary variant="line">`. One description of a slice, so a rule read in the drawer and
the same slice read on W3 cannot drift apart.

### Shipped — Phase 5 + the rest (design-kit)

| What | Note |
|---|---|
| **`@invana/editor`** — new package | `CodeBlock` (read-only by construction: no cursor, no illusion typing does something) and `MarkdownEditorBlock`. CodeMirror 6, external in the bundle so a consumer never gets a second copy. **No markdown syntax mode** — what is typed there is offered verbatim in a prompt, so highlighting would decorate text whose contract is that it is plain. Languages: python · shell · javascript · **cypher** · plain |
| `Terminal` + `TerminalLine` | prompt / output / comment lines, with one `columnTemplate` for the whole transcript — columns that line up *down* the transcript, which is the only reason to have them |
| `CitationList` + `CitationRow` | kind first: it tells the reader whether a claim rests on the right sort of evidence |
| `DiffList` + `DiffRow` | the sign is spelled out per row — colour alone must not decide an approval |
| `TimelineList` + `TimelineEntry` | `when` is a column, so "what changed on Friday" reads down one edge |
| `EmptyState` + `EmptyStateLock` | naming what unlocks each surface turns an empty screen into a sequence. Separate from `UnderDevelopment`: that says *we* have not built it, this says *you* have not filled it |
| `ChatSessionContextChip` | fills the composer's `attachments` slot — what is bound is the surface's business, not the composer's |
| `Table` `density="compact"` | one prop on the table; a table with two densities in it is always a mistake |
| `Progress` `size="sm"` | 4px — reads as part of the number above it, not as something you drag |
| forms `inputSize` / `triggerSize` | 26px application field on `Input`, `Textarea`, `SelectTrigger`. Named `inputSize` because `size` is already an `<input>` attribute meaning character width |
| `Accordion` | **no change needed** — `justify-between` with the chevron last already takes a count and a status badge. Story added so nobody adds a `count` prop |
| 10 stories | |

**Follow-up this creates**: design-kit's release pipeline has a per-package workflow
(`release-ui.yml`, `release-styling.yml`, `release-themes.yml`) and `release.sh` bumps every
`packages/*/package.json` in lockstep. `@invana/editor` will version correctly but has **no
release workflow of its own** — add one before the next release if it should publish to a
`releases/editor` branch like the others.

### Shipped — Phase 1 · the shell (design-kit, committed)

| What | Note |
|---|---|
| `ContextBar` | 28px. The view switch, the counts that matter for the work in front of you, and the shortcut that finishes it |
| `AppStatusBar` | 25px, generalised from `ChatSessionStatusBar` (which stays, thread-scoped). Adds the state marker: at application level "what state is this in" is the first question |
| `NavVertical` item `badge` | count pinned to a rail icon. The one place a rounded capsule is right — a count bubble is a round object, not a rectangle with soft ends |
| `Tabs` `size="sm"` | 30px strip / 26px trigger, via context so a caller sets it once on `<Tabs>`. Drops the inset tray: at that height it reads as a second toolbar |
| `Themes/AppV2 › ExplorerShell` story | **The acceptance test** — the whole Explorer on `AppLayoutV2`, composed only from `@invana/*`: header (breadcrumb + canvas toolbar), rail, left panel, canvas tab strip, inspector, bottom console, status bar. Left, right and bottom are all `collapsible` and each carries an explicit toggle. Lives under `Themes/AppV2` (not a `Hi-Fi/` group of its own) because it is that shell, filled in — a screen the theme can hold, not a fourth layout. Two things it corrects from the first pass: it drives the shell rather than hand-writing header/rail/panel divs, so it is responsive instead of a fixed 1440×900 box; and rail items carry `onClick`, without which `NavItems` renders them as static `<div>`s with no hover |

Why two bars rather than one: `ContextBar` describes the *surface* and changes as you navigate;
`AppStatusBar` describes the *session* and barely changes. Merging them would make a stable line
flicker with every route.

Where each bar sits, now the shell holds them both: the **footer** is the status bar — its own
`left`/`right` slots, not an `AppStatusBar` nested inside it, which would be two bars in one strip.
`ContextBar` belongs to whichever region it describes; in the Explorer story it is the bottom
console's own last row, so it disappears with the console rather than outliving the thing it counts.
`AppStatusBar` stays the component for a surface that owns its 25px strip outright.

**`Eyebrow` — the smallest heading.** `WHY IT MATTERS`, `1 · CONNECTED`, `OPTIONAL`, `WHAT NEXT`:
a label over the band it names, without the 35px and the rule a `SectionHeader` brings, so several
sit in one scrolling column and still read as subordinate to the panel's title. Uppercase at
`text-meta` with tracking — at that size caps are what separate a label from the sentence under it.
It is a component rather than four utility classes because the treatment was already retyped twice
inside the kit (`tour.tsx`, `panel-stack.tsx`); both should consume it. `tone="accent"` is for a
label naming something the reader is being *taught* — a concept, a callout's kind — and is rare by
design. Shipped in `ui-extended/eyebrow.tsx` with its story; **Studio pins `^0.0.24`, which predates
it**, and mirrors it at `studio/src/ui/Eyebrow.tsx` until the next kit release, at which point that
file is deleted and the import moves to `@invana/ui`.

**`ClampedText` — the first few lines, and the rest on request.** A project's purpose above its
Todos, an agent's instructions, a dataset's note: prose whose first sentence is what the panel is
*for*, and whose full length would push the list under it off the screen. It clamps to `lines`
(three by default) and expands **in place** — not into a tooltip and not into a dialog, because the
reader is already looking at the right place. The toggle only renders when there is something behind
it, and that is measured rather than guessed from a character count: three lines in a 320px panel is
one line in a wide one, and a `Show more` that reveals nothing teaches the reader to stop pressing
it. Shipped in `ui-extended/clamped-text.tsx` with its story; **Studio pins `^0.0.24`, which predates
it**, and mirrors it at `studio/src/ui/ClampedText.tsx` until the next kit release, at which point
that file is deleted and the import moves to `@invana/ui`. First call site: the project heading
([PT9](../modules/work/features/projects-and-tasks.md)).

The header's right cluster carries the **onboarding cap** and the theme picker, left of the Assistant. The cap is a
`ButtonWithTooltip` with a `GraduationCap` icon, rendered only on graph-scoped routes; it opens the onboarding
wizard on the graph page and never disappears, including after the Graph is ready
([13.7](../modules/platform/features/setup.md) SU19). Then Studio's own
`ThemeMenu` shape: a `Palette` icon button opening `ThemeSelector layout="form"` with `showAccent`
off (the canvas data palette is a separate decision from the app accent). The story is `selfThemed`,
so Storybook's global theme toolbar stands down and the picker in the header is the one that owns
the theme; you switch light/dark from inside the screen, which is how the real header behaves.

### The type ladder — two sizes, and the root is the dial

Chasing why the header breadcrumb read small turned up a systemic problem. `html` is 13px, but every
shadcn primitive still carried `text-sm` — authored for a 16px root, where it means "the UI size" —
so it rendered at `0.875 × 13 = 11.375px`, *below* the 12px `text-meta` step that exists to be
subordinate. Nobody chose 11.375px. The `--font-size-*` block meant to fix it never generated a
utility: Tailwind v4's type namespace is `--text-*`.

| Step | Value | @13px root (app) | @16px root (site) |
|---|---|---|---|
| `text-base` | `1rem` | 13px | 16px |
| `text-meta` | `0.923rem` | 12px | 14.8px |

Two content sizes. `lg`/`xl` stay Tailwind's defaults — they are heading steps and nothing
complained about them.

| Decision | Why |
|---|---|
| Components declare **no** font size | A hard-coded size is what stops a component being body copy on a marketing page. Default text inherits the root; deliberately subordinate text says `text-meta`, which names the job. All 61 `text-sm`/`text-xs` uses in `ui`, `forms`, `tables`, `themes` are gone |
| `--text-meta` becomes a **ratio**, not `12px` | Absolute was right while the ladder around it was broken; it is wrong now, because a px step cannot follow a root that moves — and following the root is what makes the kit render a website as well as an application. `rem` not `em`, so nested subordinate text does not compound down |
| `text-sm` / `text-xs` become **aliases** of `base` / `meta`, not deletions | 300+ call sites across canvas and invana already say `text-sm` meaning "normal UI text" and `text-xs` meaning "a step down" — exactly these two steps, so those call sites can render what their authors meant without being edited — in a build that compiles the `@theme` block, which is the catch below. Studio alone: 180 + 110 sites |
| Paired `--text-*--line-height` pinned | Re-pointing only the size left `text-xs` and `text-meta` both at 12px in rows of different heights — the same inconsistency one level down |

**The re-baseline is in the tokens, not the migration.** Because the aliases resolve to the same
two steps, removing the classes from components is visually a no-op. What moves is everything that
was 11.375px → 13px and 9.75px → 12px.

**But not yet in Studio, and the reason is worth knowing.** The aliases live in an `@theme` block,
which only exists for a build that compiles `@invana/styling` as *source*. Studio's `src/index.css`
imports the precompiled `@invana/ui/styles.css`, which carries plain `:root{--text-…}` custom
properties and no `@theme` — and since no kit component writes `text-sm` any more, Tailwind does
not emit a `.text-sm` rule into that file either. So Studio's own Tailwind regenerates `text-sm`
from its default 0.875rem and stays at 11.375px. Two ways out, and they are a real choice:

| | |
|---|---|
| Studio adds `@import "@invana/styling";` | one line; the 180 `text-sm` + 110 `text-xs` sites correct themselves. Needs a check that re-importing the token block alongside the prebuilt sheet does not fight it |
| Studio migrates its own 290 sites | explicit, no import-order subtlety, but it is 290 edits and re-baselines Studio in one commit |

Either way it is gated on the `@invana/styling` version bump: Studio pins `^0.0.20`, which on a
`0.0.x` range means exactly `0.0.20`, so none of this reaches Studio until that pin moves.

Fallout already visible: `Item`'s `group-data-[size=xs]/item:text-base` override is deleted — it
existed only to escape the 11px `text-sm`, and there is nothing left to escape. Expect more of
these; a workaround for the old ladder now reads as a component fighting itself.

**Two kit gaps this closed**:

| Gap | Fix |
|---|---|
| `SearchInput` had a hard-coded `"Search..."` placeholder, a 40px-only height and no prop pass-through — a panel-docked box could not say what it searched or match panel density | `placeholder` + `inputSize="sm"` (26px, matching `Input`'s `inputSize`), rest-props forwarded, raw `dark:bg-neutral-800` dropped. Story added |
| `ThemeProvider` documented a `storageKey` prop (including `null` to disable) but never read it — every provider shared the hard-coded `invana-theme` key, so a preview or a story restored *and overwrote* the app's saved theme | `readStorage`/`writeStorage` take the key; `null` reads and writes nothing |

### Shipped — Phase 3 · the answer surface (design-kit, committed)

Built to DS6–DS9, which already decided these are kit components.

| What | Note |
|---|---|
| `EmissionCard` + `EmissionHeader` | DS7/DS9. Header exported separately so a task result or scheduled answer shows the *same* header rather than inventing one that drifts. Takes a kind, a template name and children — never a domain object (DS6). An absent citation strip means *not applicable*; nothing to cite says `0 records`, so a missing strip never reads as an uncited claim |
| `CitationMarker` | the `prose` body's superscript |
| `CannotAnswerCard` · `DiagnosisCard` · `RepairNote` · `RetryNote` | **Four components, no shared variant prop (DS8).** Repair and retry render *on the step*; cannot-answer and diagnosis are cards. Retry means the same query again, repair means a different query — collapsing them would lose the only distinction the reader needs |
| `ClarifyCard` | parked, not failed. Options are measures the model declares, never generated — hence `detail` on every option and the footnote |
| `TemplatePicker` | unavailable options are listed with their reason, not hidden; the reason is information about the data. Re-renders from records in hand — the query does not run again |
| `ProposalCard` | draft and evidence together, so the decision is made against instances. `consequence` states what authoring will write |
| `RatingControl` + `DotRating` | the capture signal the learning loop runs on, so it states its consequence (`by`, `refines`). One control with two positions, not two buttons |
| 6 stories | incl. `run-outcomes/four-outcomes` (all four side by side) and `proposal-card`, which composes Phase 2's `PropertyList` |

`DotRating` lives beside `RatingControl` rather than in `ui/` as §3.2 planned — one caller, so
co-located until a second appears.

Verified in Storybook, light and dark, including interaction (clarify selection, template
selection, verdict + weight).

### Shipped — Phase 2 (design-kit, committed)

| What | Note |
|---|---|
| `Item` `size="xs"` + `selected` | **Q1 answered**: `Item` already *is* the entity row (`ItemMedia`/`ItemContent`/`ItemTitle`/`ItemDescription`/`ItemActions`). It needed a 30px density and a selected state, not a `ListRow` sibling. Title takes the reading size and the description clamps to one line at `xs` only, so nothing else moves |
| `SectionHeader` | 35px band: icon · title · count · actions. Count and actions are separate props — a count is a fact about the section, an action is something you do to it |
| `PropertyList` + `PropertyRow` | `<dl>` with one label-column width for the whole list, so values align down the panel |
| `Legend` + `LegendItem` | 5 swatch kinds (dot · ring · line · dashed · arrow) — a legend has to draw what the canvas draws |
| `MetricTile` + `MetricGrid` | `caption` supplies the denominator; `auto-fit` so the same tiles work in a 420px panel and full width |
| `AgentChip` | Identity, not status — deliberately not a `Badge`, takes no tone and no colour |
| `FilterBar` + `FilterChip` | Kept separate from `Toolbar`: a toolbar *does* things, this only hides rows |
| 8 stories | incl. `item/entity-row`, which composes the row from `StatusDot` + `Badge` + `AgentChip` |

Verified in Storybook, light and dark. Existing `Item` and `Badge` stories render unchanged.

### Shipped — Phase 0 (design-kit, committed)

| What | Where |
|---|---|
| `--text-meta` (12px) | `styling/index.css` — deliberately not named `2xs`, see §1.2 |
| Dead `--font-size-*` block deleted (D7) | `styling/index.css` — built CSS unchanged by zero bytes |
| `--color-edge` + dark override | `styling/index.css` |
| `StatusDot` | `ui/components/ui/status-dot.tsx` — 7 tones × 4 sizes, extracted from `ChatSessionTaskRow` |
| `Badge` `tone` × `size` | `tone` (primary/success/warning/info/muted) recolours `default`/`outline`/`soft` via two custom properties; `size` adds 18px/22px tiers. `default` renders exactly as before. **No `shape`** — the kit's radius decision forbids pills |
| `Button` `xs` + `icon-xs` | 24px tier, icon steps down to 16px with the box |
| `cn` teaches tailwind-merge the kit's own sizes | `ui/lib/utils.ts` — without it `text-meta` is read as a *colour* and silently strips the real colour class |
| 6 stories | `status-dot/{default,tones,sizes}`, `badge/{tones,sizes}`, `button/extra-small` |

Verified in Storybook, light and dark; the existing Badge showcase is unchanged.

Ordered by reuse across the 43 artboards. Every row ships with **one story per file** under the
folder named in the last column (design-kit convention: one story per file).

### 3.1 Extend what exists

| Component | Package | Change | Artboards |
|---|---|---|---|
| ~~`Badge`~~ | `@invana/ui` | ✅ shipped — `tone` × `size`. `shape` dropped: pills contradict the kit's radius decision | 43 |
| ~~`Item`~~ | `@invana/ui` | ✅ shipped — `size="xs"` + `selected`. No `ListRow`: `Item` already was the row | 30 |
| ~~`Button`~~ | `@invana/ui` | ✅ shipped — `xs` + `icon-xs` (24px) | 43 |
| ~~`NavVertical`~~ | `@invana/ui` | ✅ shipped — `badge` on `NavItemConfig` | 36 |
| ~~`TreeView`~~ | `@invana/ui` | **dropped** — row 37 settled it: the Layers tree is canvas-ui's `LayersViewPanel`, which already has the visibility API. No board screen needs an eye toggle on the generic tree | — |
| ~~`Tabs`~~ | `@invana/ui` | ✅ shipped — `size="sm"`. `TabbedPanel` untouched | 43 |
| ~~`Progress`~~ | `@invana/ui` | ✅ shipped — `size="sm"` | 2 |
| ~~`Accordion`~~ | `@invana/ui` | ✅ **no change needed** — it already composes; story added | 1 |
| ~~`Table`~~ / ~~`DataTable`~~ | `@invana/ui` / `@invana/tables` | ✅ shipped — `density="compact"` and `groupBy` / `renderGroupHeader` | 12 |
| ~~`ChatSessionStatusBar`~~ | `@invana/ui` | ✅ shipped as `AppStatusBar`; the chat one stays, thread-scoped | 36 |
| ~~`ChatSessionComposer`~~ | `@invana/ui` | ✅ shipped as `ChatSessionContextChip` | 36 |
| ~~`UnderDevelopment`~~ | `@invana/ui` | ✅ `EmptyState` added alongside; `UnderDevelopment` left as-is (different meaning) | 1 |
| ~~forms fields~~ | `@invana/forms` | ✅ shipped — `inputSize` / `triggerSize` | 4 |

### 3.2 New — primitives (`packages/ui/src/components/ui/`)

| Component | What it is | Artboards | Story folder |
|---|---|---|---|
| ~~`StatusDot`~~ | ✅ shipped — 7 tones × 4 sizes | 43 | `ui/ui/status-dot/` |
| ~~`DotRating`~~ | ✅ shipped — co-located with `RatingControl`, one caller | 1 | `ui/ui-extended/rating-control/` |

### 3.3 New — composites (`packages/ui/src/components/ui-extended/`)

| Component | What it is | Artboards | Story folder |
|---|---|---|---|
| ~~`SectionHeader`~~ | ✅ shipped | 20 | `ui/ui-extended/section-header/` |
| ~~`PropertyList`~~ | ✅ shipped — with `PropertyRow` | 14 | `ui/ui-extended/property-list/` |
| ~~`MetricTile` + `MetricGrid`~~ | ✅ shipped | 6 | `ui/ui-extended/metric-tile/` |
| ~~`Legend`~~ | ✅ shipped — 5 swatch kinds, incl. `ring` | 30 | `ui/ui-extended/legend/` |
| ~~`FilterBar`~~ | ✅ shipped — with `FilterChip` | 12 | `ui/ui-extended/filter-bar/` |
| ~~`ContextBar`~~ | ✅ shipped | 36 | `ui/ui-extended/context-bar/` |
| ~~`AgentChip`~~ | ✅ shipped | 10 | `ui/ui-extended/agent-chip/` |
| ~~`CitationList`~~ | ✅ shipped — with `CitationRow` | 5 | `ui/ui-extended/citation-list/` |
| ~~`DiffList`~~ | ✅ shipped — with `DiffRow` | 3 | `ui/ui-extended/diff-list/` |
| ~~`TimelineList`~~ | ✅ shipped — with `TimelineEntry` | 3 | `ui/ui-extended/timeline-list/` |
| ~~`Terminal`~~ | ✅ shipped — with `TerminalLine` and a shared column grid | 1 | `ui/ui-extended/terminal/` |

### 3.4 New — the answer surface (`ui-extended`)

Already mandated by `design-system.md`: **DS6** (a kit component takes a kind, a template name and
rows — never a domain object), **DS7** (one emission header everywhere), **DS8** (the four run
outcomes are four components, never a variant prop), **DS9** (a kind is a body inside the emission
card). This section is the build list for those decisions.

**Decision D3** — no separate package. These live in `@invana/ui` alongside `TabbedPanel` and
`TreeView`: they need no external dep, and the whole kit is Invana's anyway. Keeping one package
means one version, one import, one story tree.

| Component | What it is | Artboards | Story folder |
|---|---|---|---|
| ~~`EmissionCard`~~ | ✅ shipped — with `EmissionHeader` (DS7) and `CitationMarker` | 12 | `ui/ui-extended/emission-card/` |
| ~~`CannotAnswerCard`~~ | ✅ shipped | 3 | `ui/ui-extended/run-outcomes/` |
| ~~`DiagnosisCard`~~ | ✅ shipped. Plus `RepairNote` + `RetryNote` — DS8's four outcomes are four components | 2 | `ui/ui-extended/run-outcomes/` |
| ~~`ClarifyCard`~~ | ✅ shipped | 2 | `ui/ui-extended/clarify-card/` |
| ~~`TemplatePicker`~~ | ✅ shipped | 1 | `ui/ui-extended/template-picker/` |
| ~~`ProposalCard`~~ | ✅ shipped | 2 | `ui/ui-extended/proposal-card/` |
| ~~`RatingControl`~~ | ✅ shipped — with `DotRating` | 1 | `ui/ui-extended/rating-control/` |

### 3.5 New — charts (`ui-extended`)

**Decision D4** — also in `@invana/ui`. SVG/CSS only, no charting dep, token-driven off the data
palette (§3.8). Follow the `dataviz` guidance for palette, mark specs and legend rules.

| Component | What it is | Artboards | Story folder |
|---|---|---|---|
| `BarChartH` | 🚧 built, TODO — pending design review | 4 | `ui/ui-extended/charts/` |
| `BarChartV` | 🚧 built, TODO | 1 | `ui/ui-extended/charts/` |
| `DivergingBar` | 🚧 built, TODO | 1 | `ui/ui-extended/charts/` |
| `HeatStrip` | 🚧 built, TODO | 1 | `ui/ui-extended/charts/` |
| `Sparkline` | 🚧 built, TODO | 0 | `ui/ui-extended/charts/` |

### 3.6 New — editor (external dep, so its own package)

The one exception. Per design-kit convention, anything needing an external JS library gets its own
package — so CodeMirror does not enter `@invana/ui`'s dependency graph.

| Component | Package | Dep |
|---|---|---|
| ~~`MarkdownEditorBlock`~~ ✅ shipped | `@invana/editor` | CodeMirror 6 |
| ~~`CodeBlock`~~ ✅ shipped — python · shell · javascript · cypher | `@invana/editor` | CodeMirror 6 |

### 3.7 Not design-kit — `@invana/canvas-ui`

`@invana/canvas-ui` already peer-depends on `@invana/ui`/`forms`/`styling`/`themes` and owns every
canvas pixel. **Most of what the board needs here already exists** — the earlier draft of this
document wrongly listed these as gaps.

**Released and consumable.** Every `@invana/*` canvas package is on npm at **`0.0.12`**, and Studio
is pinned there. Two things move with it, and both are breaking:

| Change | What it means |
|---|---|
| The React *components* left `@invana/canvas-react` for `@invana/canvas-ui` | `CanvasMessageBar` · `GraphStatusBar` · `Graph{Node,Edge,Background}ContextMenu` (+ their menu-context types) · `ToolbarItem(s)` · `applyIconOverrides`. `canvas-react` keeps the hooks, behaviours, layers and layout bindings |
| Renames and a tightening | `LabelResolutionLODBehaviour` → `TextResolutionLODBehaviour`; `ColorByLabelBehaviour` → `ColorByBehaviour`; `GraphEdge` now requires `type` |

`canvas-ui` also ships more than §3.7 listed: `BoardPagesViewPanel` (a tab strip **and** the page
bodies as one column, `keepMounted` so a tab switch is visibility rather than a remount),
`FindInCanvasViewPanel`, `CanvasFiltersViewPanel`, `SchemaViewPanel`, `SchemaEditorPanel`,
`InspectorPanel`, `NodeDetailView`/`EdgeDetailView`, `PropertiesEditor`, `ExportImagePanel` and the
whole editor-panel set. `canvas-ui/apps/AppLayoutV2` in the canvas Storybook is the reference for
driving all of it from `AppLayoutV2`'s regions — the canvas-side twin of `Themes/AppV2 ›
ExplorerShell`.

| Board element | canvas-ui | Status |
|---|---|---|
| Canvas tool cluster | `CanvasControlsToolbar` | ✅ |
| Canvas caption strip | `CanvasMessageBar` | ✅ |
| Layers panel (indent · eye · swatch · count) | `LayersViewPanel` — native visibility API on the store (`hideNodes` · `showNodes` · `isNodeHidden` · `hideNodesByPredicate` · `showAllHidden`) | ✅ shipped in `0.0.12` |
| Canvas tab strip + page bodies | `BoardPagesViewPanel` | ✅ replaces Studio's `CanvasTabsBar` |
| Minimap | `MiniMapLayer` (`@invana/graph`) + `MiniMapLayerEditorPanel` | ✅ |
| Canvas status bar | `GraphStatusBar` | ✅ |
| Panels, context menus, find-in-canvas, filters, pages | `Panel`, `PanelContent`, `menus/*`, `view-panels/*` | ✅ |
| Whole canvas app shell | `GraphCanvasApp` + header/footer | ✅ |
| Node/edge type → colour | canvas owns the map; the **palette** is a `@invana/styling` token set (D2) | ✅ palette shipped. A graph with more types than slots repeats them — identity is carried by the label, never by colour alone |
| `SubgraphPreview` (thumb + counts + Show) | build on `exportSVG` | ❌ |

**Direction of travel**: where canvas-ui has invented something general — `DetailCard`/`DetailRow`
(→ `PropertyList`), its panel chrome, its status bar — **promote it down into `@invana/ui`** and
have canvas-ui consume it. A component belongs in the lowest layer that can own it.

### 3.8 Tokens — `@invana/styling`

| Addition | Why |
|---|---|
| ~~`data-density="compact"`~~ | superseded — the kit is already dense (§1.2, D1). Shipped instead: `--text-meta` (12px) and a `size="xs"` tier on the controls that need one |
| ✅ `--color-edge` + dark override | graph edge colour, used on every canvas |
| ✅ Categorical **data palette** — `--color-data-1…8` in `themes/data-palette.css` (D2) | node/edge types, chart series, legends. Eight hues, fixed order, both modes selected and validated against the kit's own card surfaces. Light carries a contrast WARN on aqua/yellow/magenta, admissible only because every use names the thing beside the swatch. First consumers: the Explorer type panel's dots and the canvas node fill, both through `studio/…/explorer/lib/typeColor.ts` |
| ✅ The **type ladder** — `--text-meta: 0.923rem` (was `12px`), plus `--text-sm` / `--text-xs` re-pointed to `base` / `meta`, each with its `--line-height` pinned (D7) | two content sizes, every step a ratio of the root, so the root is the one dial. Reaches a consumer only if that consumer compiles this `@theme` block — see the caveat under the ladder section |
| ~~Status tone tints (`--success-soft`, …)~~ | **not needed** — `Badge`'s `soft` variant mixes from `--badge-solid` at the point of use, so a tone needs no second token. Add tokens only if a soft tint is ever needed outside a component |

The density set:

```css
:root[data-density="compact"] {
  --control-h-xs:   22px;   /* chips, inline pills */
  --control-h-sm:   24px;   /* icon buttons, small selects */
  --control-h:      26px;   /* inputs, buttons */
  --control-h-lg:   32px;   /* footer actions */
  --row-h:          30px;   /* list rows */
  --section-h:      35px;   /* panel section headers */
  --line-height:    1.45;
}
```

The two `--font-size-*` entries this block used to carry are gone: that namespace generates no
Tailwind utility. Type is the `--text-*` ladder above, and it is not part of the density attribute
— a density switch changes control heights and row heights, while type follows the root.

Board and Studio set `data-density="compact"` on the root. Every kit component reads these tokens
instead of hard-coded `h-8`/`h-9`, so density is one attribute, not a prop on every call site.

---

## 4. Decisions

All seven are **decided**. D1 and D7 are restated where the build overtook them. Stated in present tense; the argument that produced them is not kept.

| # | Decision |
|---|---|
| **D1** | ~~Compact density ships as an opt-in `data-density="compact"` attribute.~~ **Superseded by §1.2**: the kit is already at the board's 13px base, so a density axis would be machinery around a gap that is one size tier wide. Density ships as `size="xs"` on the controls that need it, plus a `--text-meta` step. Existing sizes are untouched, so no story re-baselines — which is what D1 was really protecting. |
| **D2** | The categorical **data palette** lives in `@invana/styling`. Charts, legends, list dots and `@invana/canvas` all read the same scale. |
| **D3** | The **answer surface** (Emission, CannotAnswer, Diagnosis, Clarify, TemplatePicker, Proposal, Rating) lives in `@invana/ui/ui-extended`. No separate package: no external deps, one version, one import. |
| **D4** | **Charts** live in `@invana/ui/ui-extended`, SVG/CSS only, token-driven. No charting dependency. |
| **D5** | The board is a **published Claude Artifact** running real design-kit components from a self-contained bundle (§5). Whole-screen artboards live only there; per-component stories remain mandatory in design-kit's Storybook. |
| **D6** | The **editor** components (`CodeBlock`, `MarkdownEditorBlock`) get their own `@invana/editor` package, because CodeMirror 6 is an external dependency and must stay out of `@invana/ui`'s graph. |
| **D7** | The kit has **two content sizes and one dial**: `text-base` (`1rem`) and `text-meta` (`0.923rem`), every step a ratio of the root, so moving `html` from 13px to 16px turns the same components from an application into a website. Components declare no font size — default text inherits, subordinate text says `text-meta`. `lg` and up stay Tailwind's heading defaults. `text-sm` / `text-xs` are compatibility aliases of `base` / `meta` for the 300+ existing call sites in canvas and invana, not sizes new code picks. Every `--text-*` token carries its paired `--line-height`, and is registered in `@invana/ui`'s `cn` at the same time — otherwise tailwind-merge reads it as a colour and strips the real one. |

---

## 4a. Track A — Studio builds every screen

**The scope changed.** This section used to say Studio adopts the shell on three pages and the other
screens follow their slices. It now says Studio builds **all forty-two artboards**, ahead of their
engine ([DS14](../modules/platform/features/design-system.md)). A screen whose API
has not landed is marked 🖼 in the index, renders an `EmptyState` naming what unlocks it, and
fabricates nothing (DS15).

### Three corrections — what this section got wrong

Each re-checked against `design-kit@0.0.23` and Studio's tree, not assumed.

| It said | Actually | So |
|---|---|---|
| `AppLayoutV2` renders main through a `leftSection ? <Group>…</Group> : <div>…</div>` ternary, so toggling a panel remounts the canvas — **and this blocks everything** | **Fixed.** `renderEditorRow` always wraps the editor in the same `ResizablePanelGroup`/`ResizablePanel` with stable ids; each side panel is a conditional *sibling*. The code says why, at `themes/src/app-v2/layout.tsx:160-167` | The blocker is gone. `GraphDetail` can drive the shell today, and its own workaround comment (`GraphDetail.tsx:221-235`) is now describing a bug that no longer exists |
| A0 is pending | **Done.** Studio pins `^0.0.23` across `ui`/`forms`/`themes`/`styling`, `@import "@invana/styling"` is the first line of `src/index.css`, and Studio's own ladder is deleted | Nothing is gated on the pin |
| A1 (kit gaps) comes before A2 | The three gaps are **three `!`-overrides, none blocking**. Studio already carries the same eight classes at `useGraphLeftNav.tsx:107` | The kit fix moves *after* the adoption, so the default is chosen from what a real page needed |

One thing the section did not see at all: **Studio has a parallel component layer** — five shell
components and a whole answer surface that the kit now ships. That is DS1, and it is the first work,
not the last (DS17).

### Order

The code shape these screens land in — feature modules, the deletion list, routing, and the
guardrails that keep forty-two screens maintainable — is
[`code-shape.md`](code-shape.md). Its phases 1–4 come **before** A1 below; A1–A6 are its
phases 5–7.

| # | Work | Done when |
|---|---|---|
| ✅ **A0** | The `^0.0.23` pin; `@import "@invana/styling"`; Studio's ladder deleted (D7 · DS13) | Studio renders at 13/12px and nothing else moved |
| ✅ **A1 · Delete the parallel layer** | ✅ `PanelChrome` **deleted** (§6a) · `WorkRow` → `Item size="xs"` + `StatusDot` + `Badge tone` · `CanvasTabsBar` → `TabbedPanel variant="strip"` · `GraphStatusBar` → `AppStatusBar` · `emissions/EmissionCard` → `EmissionCard` + `EmissionHeader` · `NotAnAnswer` → `CannotAnswerCard` + `DiagnosisCard` · `TemplatePicker` · and the eleven shadows §6c names (DS17) | ✅ `grep` finds no Studio component that shadows a kit export |
| **A2 · The shell** | `GraphDetail` deletes its `ResizablePanelGroup` and drives `leftSection` · `mainSection` · `rightSection` · `bottomSection` · `footer` (DS12) | A panel toggle does not remount the canvas — the reason the workaround existed. ~90 lines of layout gone |
| **A3 · Explorer composes to the contract** | Types panel → `TabbedPanel` + `PanelStack`; inspector → `PropertyList`; header centre → `centerNavItems`; rail one-key-one-column (DS16) | `ExplorerPage.tsx` composes; no hand-written panel chrome |
| **A4 · The console** | `bottomSection` + `ContextBar`, per [explore 4.5](../modules/explore/features/the-console.md) | Records and query readable under the canvas; `?console=` survives reload. Closes S12f |
| **A5 · Close the kit gaps** | design-kit — `NavVertical` `active`, `TabbedPanel variant="strip"`, header/footer default heights → release → both the story and Studio drop the overrides | The ExplorerShell story carries no `!` override |
| **A6 · The forty-two screens** | The batches below, one commit each, this map updated with it | Every artboard has a route; each is ✅ or 🖼 in the index, never a lie |

A2 is still the step that pays: every later region — the console, and the thirty-odd screens after
it — becomes a prop rather than a nested panel group.

### The three kit gaps (A5)

A gap shows up in the story as an `!`-override. Porting one into Studio makes it permanent.

| Gap | In the story | Also in Studio | Fix |
|---|---|---|---|
| Rail active state | `railItem`'s `!bg-primary/15 !text-primary !ring-primary/25` and the hover re-assertion | `useGraphLeftNav.tsx:107` `activeClass` — the same eight classes, copied | `NavVertical` item takes `active`; the highlight is a prop, not an override |
| Header-only tab strip | `className="[&>div]:border-x-0 [&>div]:border-t-0"` + `bodyClassName="hidden"` on the canvas tabs | `explorer/CanvasTabsBar.tsx` | `TabbedPanel variant="strip"` — a strip that owns no body, so the canvas below stays mounted |
| Bar heights | `header.className: '!h-[38px]'`, `footer.className: '!h-[25px]'` | `useAppHeader` · `GraphDetail` | The shell owns 38 and 25. A caller that has to say it in `!` is being told the wrong default |

### A fourth gap — an icon-only control had no name

`NavItems` renders `item.name` into a `TooltipContent`. A tooltip is not a label and is not in the
tree until hover, so every icon-only control composed on it reached a screen reader as an **unnamed
button** — `‹ Back`, `+ New skill`, `+ New invariant`, `Promote a plan…` and `Export YAML`, which is
every `PanelStack` header action Studio ships — and a Playwright spec could only find one by
position.

| | |
|---|---|
| Fix | An item that renders no visible `label` gets `aria-label={item.name}` on its control (`ui-extended/nav-base.tsx`). `name` is required and is already what the tooltip shows, so nothing new is asked of a caller |
| Reaches Studio | on the next `@invana/ui` release — **the change is made and unreleased**, and `0.0.29` is what Studio resolves |
| What it unblocks | locating header actions by role + name instead of by position, which is what lets the Skills and Library panels be driven by a spec at all |

It rides with the `lead` slot [SK27](../modules/skills/features/authoring-a-skill.md#decisions)
already owes, since both are one release of the same package.

### A6 — the forty-two screens

Every artboard, its status and the feature it draws now live in
**[the-screens.md](../the-screens.md)** — the screen index, sibling to the feature index. It is the
one place a screen's status is kept, and the place to look when the question is "is this drawing
built yet".

The batches there are this phase's build order: Explorer and the answer surface, then model/data/
settings, then agents, work, review, skills/rules/workflows, and operate. Each batch is one commit,
and the screen's `Kit` cell flips when it lands on the shell.

### The risk, stated once

A screen built against an API that does not exist encodes a guess about that API's shape. The guess
is cheap while the screen is layout plus an `EmptyState`, and expensive once forms and tables are
bound to it. So a 🖼 screen stops at the layout and the empty state; its data-shaped parts wait for
the engine. That is what keeps DS14 from becoming forty-two screens to rewrite.

---

## 5. The rebuilt board — `invana-hifi-with-design-kit`

**The board is a published Claude Artifact** that runs the real `@invana/*` components — not HTML
that imitates them. This is what makes drift impossible: an artboard is React composed from the
kit, compiled ahead of time, so a screen needing a component the kit lacks **does not build**.

### 5.1 How it works

The artifact is one self-contained HTML file. Everything is inlined; nothing is fetched at runtime.

```
.design/board/                     (source, in this repo)
  artboards/explorer.tsx           43 artboards, React, @invana/* only
  artboards/agents.tsx
  ...
  frame.tsx                        1440×900 artboard frame + label + status
  canvas.tsx                       pan/zoom board surface, artboard grid
  index.tsx                        entry
  build.mjs                        esbuild → one IIFE + inlined CSS → board.html
```

| Concern | How it is handled |
|---|---|
| React | **bundled into the IIFE**, not loaded from a CDN. React 19 ships no UMD build, and bundling removes every CSP and network concern. |
| design-kit | `@invana/ui` + `themes` + `forms` + `tables` bundled from the workspace (or from the published version — see 5.3). `ui/dist/index.js` is 154 KB; the whole bundle lands well inside the artifact's 16 MB budget. |
| Styles | `@invana/ui/dist/styles.css` (77 KB, Tailwind-compiled) inlined into a `<style>` block, plus `@invana/styling` tokens. |
| JSX | compiled by esbuild at build time. No Babel-standalone at runtime. |
| Light + dark artboards | each artboard frame carries its own `light`/`dark` class, the way `.root.light`/`.root.dark` does today — so the board shows both regardless of the viewer's theme. The page chrome itself follows the viewer's theme. |
| Canvas | **no PixiJS at runtime.** `@invana/canvas/io` ships `exportSVG(canvas, opts)` and `imageExport` — the board embeds SVG produced by the real engine from real data, per artboard, generated at build time. The canvas *chrome* (`CanvasControlsToolbar`, `CanvasMessageBar`, `LayersViewPanel`, `GraphStatusBar`) is live `@invana/canvas-ui`, since it is plain React. |
| Publishing | `Artifact` tool with `file_path: .design/board/board.html`, same URL on every redeploy. |

Estimated payload: ~450 KB JS + ~90 KB CSS + artboard code. Well within budget.

### 5.2 What the board shows

| Layer | Content |
|---|---|
| Canvas | 43 artboards laid out on one pan/zoom surface, grouped by journey: Bind → Data → Observe → Decide → Evolve (the `StoryIndexHiFi` order) |
| Per artboard | title, the story ids it serves, and a **coverage chip** — which components are real kit components vs still stubbed |
| Index page | `StoryIndexHiFi` rebuilt as a live tracker: 56 stories → screen → status → kit coverage % |

### 5.3 Pinning

| Mode | When |
|---|---|
| Local checkout | while building components — `INVANA_DESIGN_KIT` / `INVANA_CANVAS` (design-system.md DS10/DS11) point the build at `~/Projects/invana/design-kit` and `~/Projects/invana/canvas`. A kit change is one `pnpm build` away from the board; **nothing is published to npm to see it** |
| Pinned release (`@invana/ui@x.y.z`) | when publishing the board — the artifact states which kit and canvas versions it was built against, so a board and a Studio release can be compared |

`build.mjs` reads the same two env vars as Studio's Vite config, so the board and Studio always
agree about which checkout they are looking at.

### 5.4 Guardrail

`build.mjs` fails the build if any artboard file contains a raw `hsl(`, `#rrggbb`, a `style={{}}`
literal, or an element outside `@invana/*`. That is the mechanical form of the rule in
`CLAUDE.md` › Design rules.

### Sequence

| Phase | Work | Done when |
|---|---|---|
| ✅ **0 · Foundations** | D1–D4; compact density tokens; `--edge`; data palette; `Badge` tones; `Button`/`Tabs` compact sizes. **Plus the board harness**: `.design/board/` + `build.mjs` + the guardrail, publishing one empty artboard | the artifact publishes and renders one 1440×900 frame at board density, no inline styles |
| ✅ **1 · Shell** | `AppLayoutV2` + `NavHorizontal`/`NavVertical` + `ContextBar` + `AppStatusBar` as one `HiFiFrame` component | `ExplorerHiFi` shell reproduces pixel-close on the board |
| ✅ **2 · Rows & sections** | `StatusDot`, `SectionHeader`, `PropertyList`, `FilterBar`, `Legend`, `AgentChip`, `ListRow`/`Item`, `MetricTile` | 12 list-shaped artboards on the board: Agents, Datasets, Projects, Schedules, Workflows, Review, Skills, Modeller, Stitch |
| ✅ **3 · Answer surface** | `ui-extended` — Emission family, CannotAnswer, Diagnosis, Clarify, TemplatePicker, Proposal, Rating; context chip | Assistant rebuilds on all 36 artboards; `RunOutcomesHiFi` is 4 stories |
| ✅ **4 · Charts** | `ui-extended` — BarChartH/V, DivergingBar, HeatStrip, Sparkline | AgentStats, ProjectionSwitch, Session, Schedules rebuild |
| ✅ **5 · Editors** | `@invana/editor` — CodeBlock, MarkdownEditorBlock; `Terminal` | Rules, Skills, CLI rebuild |
| **B0 · Harness** | `.design/board/` — `frame.tsx`, `canvas.tsx`, `build.mjs` and the §5.4 guardrail. Never built; Phase 0's ✅ was the design-kit half | the artifact publishes and renders one 1440×900 frame with no inline styles |
| **B1 · Explorer** | `artboards/explorer.tsx` — the ExplorerShell story, minus the story-only bits | the board's Explorer and Studio's Explorer are the same composition |
| **B2 · Batches** | the other 41 by shape: 12 list-shaped · 8 assistant/answer · 4 charts · 3 editors · 6 canvas · misc. One commit per batch, this map updated with it | each batch renders light and dark, guardrail green |
| **6 · Canvas** | wire live `@invana/canvas-ui` chrome + build-time `exportSVG` per artboard; new `SubgraphPreview`; promote `DetailCard` → `PropertyList` | Explorer, CanvasLayers and every canvas overlay render from the real engine |
| **7 · Close** | Remaining artboards; the `StoryIndexHiFi` tracker page; retire `.design/hi-fi-finance/*.html` to `legacy/` | all 43 artboards are on the board; coverage table is 100% |

### Rough size

| Phase | New components | Extended | Stories |
|---|---|---|---|
| 0 | — | 8 | ~8 |
| 1 | 2 | 2 | ~4 |
| 2 | 8 | 3 | ~11 |
| 3 | 8 | `NavVertical` | ✅ | item `badge` — a count pinned to a rail icon |
| 4 | 5 | — | ~5 |
| 5 | 3 | 1 | ~4 |
| 6 | 4 | — | ~4 |
| **Total** | **30** | **15** | **~50 kit stories + 43 artboards** |

---

## 6b. A rail is a `PanelContent`, not a one-tab `TabbedPanel`

`ListPanelChrome` drew every left rail as a `TabbedPanel` holding a **single permanent tab** — a tab
you cannot leave is not a tab. It is a `PanelContent` now, which is what a rail always was: a title,
header actions, a scrolling body, a footer.

The switch is not cosmetic. The two components are different shapes, and the difference is why three
Studio components existed at all:

| | Body | Footer |
|---|---|---|
| `TabbedPanel` | `h-[calc(100% - 30px)]` | `CardFooter` stacked **below** that — a real footer overflows |
| `PanelContent` | `min-h-0 flex-1 overflow-y-auto` | `shrink-0 border-t` — **a real flex child** |

| What it bought | Detail |
|---|---|
| A footer that holds its height | The composer used to be smuggled *inside* the tab content with a comment explaining why. `footerContent` now works, which is what lets the action bar and the status bar stop being body-rendered components |
| A title that may carry a link | `PanelContent`'s title is a `<span>`; a `TabbedPanel` tab label is inside a button, so a breadcrumb there could not navigate without nesting one interactive element in another. The Model panel's `Models ›` crumb went back to the header because of this |
| One fewer fiction | `tab={{ value, label, icon }}` became `title` + `icon`, because a name that has stopped being true is a bug (code-shape §4.1a) |

## 6c. No Studio component shadows a kit export

The `^0.0.30` pin brought the kit past the two components Studio was mirroring by hand, and a sweep
of every `export function <Name>` in `studio/src` against `@invana/ui`'s export list found nine more
shadows. All eleven are gone. The check is mechanical and is the A1 "done when": no name Studio
declares is also a name the kit exports.

| Was, in Studio | Now | Why it was there |
|---|---|---|
| `ui/Eyebrow.tsx` | **deleted** — `Eyebrow` | a mirror, pinned to `^0.0.24`, waiting on the release that has now happened |
| `ui/ClampedText.tsx` | **deleted** — `ClampedText` | the same mirror, the same release |
| `NotAnAnswer` › `CannotAnswerCard` | `RunCannotAnswer` over `CannotAnswerCard`, `children` + `remedy` | the kit takes slots, not a domain object (DS6) — the mapping is what stays |
| `NotAnAnswer` › `DiagnosisCard` | `RunDiagnosis` over `DiagnosisCard`, `code` + `attempted` + `actions` | as above; `Diagnosis.cause` is the kit's `code` |
| `answer-surface/EmissionCard` › `EmissionCard` | `AnswerEmission` over `EmissionCard`, in `AnswerEmission.tsx` | the header, the rule under it and the card were redrawn from the same spec the kit already ships (DS7 · DS9) |
| `answer-surface/AnswerEmission` › `EmissionHeader` | the kit's, through `EmissionCard`'s slots | one header wherever an emission appears, or the two drift |
| `answer-surface/AnswerEmission` › `TemplatePicker` | `TemplatePicker` in a `Popover` | the kit's picker is the list; the trigger is the header's template segment |
| `useAppHeader` › `Breadcrumb` | `Breadcrumb` + `BreadcrumbList`/`Item`/`Link`/`Page`/`Separator` | the last crumb is a `BreadcrumbPage`, so it carries `aria-current`, which the hand-rolled one never did |
| `DeclareStitchPanel` › `Card`/`CardHeader`/`CardFooter` | `Card` + `CardHeader` + `CardTitle` + `CardFooter` | three local names that shadowed the kit's; the card's width and elevation are two constants now |
| `SessionTurn` › `Spinner` | `Spinner` | a hand-spun border-ring where the kit ships one |
| `PlatformEventsPage` · `EventsSection` › `EmptyState`, `NoMatches`, `FilterBar` | `EmptyState` (`title` + `description`) · `FilterBar` (`summary`) | both pages are list surfaces, and the kit says every list surface carries one filter row and one empty state |
| `WorkGraphCanvas` › `Legend`/`LegendItem` | `Legend` + `LegendItem` (`kind` + `color`) | the swatch was hand-drawn per key; `swatchKind`/`swatchColour` map a `LegendKey` onto the kit's |

### What did not move, and why

| Stayed | Reason |
|---|---|
| `ui/PanelSection` · `ui/PanelStatusBar` · `ui/FilterSelect` · `ui/PrincipalChip` | compositions **over** kit components, not copies of them. Still kit candidates (§6a), still tracked by G3/G4 |
| `ui/PolicyFlag` · `ui/BindRefusalCard` | Invana rules, not markup shapes — the agent-policy tri-state and the bind refusal's two halves (DS2) |
| `ui/layerPalette.ts` | the kit ships **no** hues; which colour means `llm` is the product's decision, passed as `palette` at every call site |
| `RunCannotAnswer` · `RunDiagnosis` · `AnswerEmission` · `CanvasLegend` · `StitchCardHeader` · `HeaderBreadcrumb` · `TemplateSwitcher` | the renamed hosts of the substitutions above — a Studio-shaped wrapper whose body is kit components. **An adapter never takes the name of the component it wraps**: five Govern and Agents files import the kit's `CannotAnswerCard` directly, and two things called that is the drift the sweep exists to stop (code-shape §4.1a) |

### Two readings that changed

| Surface | Change |
|---|---|
| A diagnosis' evidence | was behind an `Evidence ▾` toggle; it is now always shown, in the kit's *what was tried* box. The kit's card is built from evidence, so hiding it was Studio disagreeing with the component |
| The events filter row | was a two-row block; it is the kit's 30px `FilterBar`, with the visible count as its `summary` |

### The fifth gap

| # | Gap | Detail |
|---|---|---|
| **G5** | `TemplateOption.kind` is typed `EmissionKind` | A template's `surface` is the wider vocabulary an emission kind is drawn from — `markdown`, `confirm`, `choice` ([projections](../modules/ask/features/projections.md)) — and the picker only ever prints it. Studio casts. Widening the slot to `React.ReactNode`, or to the surface vocabulary, retires the cast |

## 6a. `PanelChrome` is gone — where its fourteen went

`shared/PanelChrome.tsx` (510 lines, 14 exports, ~92 call sites across 10 panels) is deleted. The
hand-rolled markup in it is gone: every piece now draws with a kit primitive or not at all.

| Was | Now | |
|---|---|---|
| `FieldPill` | **deleted** — 0 call sites, plus a dead re-export in `AgentDetail` | ✅ |
| `FilterChipRow` | inlined — `FilterBar summary={…}` | ✅ |
| `ToggleChip` | inlined — `FilterChip active aria-pressed onClick` | ✅ |
| `PanelSection` | `ui/PanelSection` over `SectionHeader` | kit candidate |
| `PanelCrumbs` | ✅ **deleted** — the kit's `Breadcrumb` inlined at all 7 sites. The last step is a `BreadcrumbPage`, so it carries `aria-current`, which the hand-rolled one never did | ✅ |
| `PrincipalChip` | `ui/PrincipalChip` over `AgentChip` | kit gap — see below |
| `PanelStatusBar` · `StatusCount` · `StatusCrumb` | `ui/PanelStatusBar` over `AppStatusBar` | kit candidate |
| `PanelActionBar` · `PanelAction` | ✅ **deleted** — `CardFooter` + `Button`, inlined at all 8 sites | ✅ |
| `PanelTabsList` · `PanelTab` | ✅ **deleted** — `Tabs size="sm"` + the kit's own `TabsList`/`TabsTrigger`, restyle dropped | ✅ |
| `FilterSelect` · `FilterChipOption` | `ui/FilterSelect` over `FilterChip` | kit gap — see below |
| `PolicyFlag` | `ui/PolicyFlag` | **stays** — DS2, the tri-state is an Invana agent-policy rule |

`src/ui/` is what code-shape §4 reserves for "only components the kit cannot own". Everything above
marked *kit candidate* is a composition with no Invana noun in its props, so by the design rules it
belongs in `@invana/ui` and this folder is its staging post, not its home.

### Four gaps the deletion surfaced

| # | Gap | Detail |
|---|---|---|
| ~~**G1**~~ | ~~`Toolbar` is a **stub**~~ | **Closed, by not needing it.** `@invana/ui`'s `Toolbar` is still `React.FC` with no props, rendering a hardcoded lock button, `Docs` and `Source` — but a panel's action row never needed it. `CardFooter` is already `flex items-center p-3`, which with `border-t` *is* the band, so the row is `CardFooter` + `Button` and nothing else. The kit's `Toolbar` remains broken and unused |
| ~~**G2**~~ | ~~`Tabs size="sm"` draws a **pill**, not an underline~~ | **Closed, by conceding.** Studio's underline was a fork of the kit's tab; DS1 says the kit is the only component layer, so the restyle went and the kit's pill look stands. The kit still disagrees with itself — `TabbedPanel` underlines its triggers where `Tabs size="sm"` fills them — but that is a question for design-kit, not a thing Studio patches around |
| **G3** | `AgentChip` cannot be pressed | It is a `<span>`, so a clickable principal needs a real `<button>` around it or the keyboard cannot reach it. `asChild`, or a button render, retires `ui/PrincipalChip` |
| **G4** | `FilterChip` has no options | It is a button with no notion of a picker, so a chip that selects needs a native `<select>` laid over it. A `FilterSelect` beside it, or an options prop, retires `ui/FilterSelect` |
| **G5** | `TemplateOption.kind` is too narrow | Typed `EmissionKind`, but a template's `surface` is the wider vocabulary — see §6c |

## 6. Open

Questions that surface during the build, to answer when they do:

| # | Question | Surfaces in |
|---|---|---|
| ~~Q1~~ | ~~`Item` or a `ListRow` sibling?~~ — **answered**: `Item`, extended with `size="xs"` and `selected`. No new component |  |
| ~~Q2~~ | ~~PixiJS in the artifact?~~ — **answered**: no. `exportSVG` from `@invana/canvas/io` renders each artboard's canvas at build time; the chrome stays live React (§5.1) | — |
| Q3 | Do the four annotated mock artboards (`AssistantShell`, `AssistantList`, `AssistantThread`, `AssistantInspector`) move to the board, or retire? They document a decision already taken. | Phase 7 |
| ~~Q5~~ | ~~The dead `--font-size-*` block~~ — **answered**: deleted, and the ladder that replaces it is authored under `--text-*` (D7) | — |
| ~~Q6~~ | ~~What is the deliberate type ladder?~~ — **answered**: two content sizes, `base` and `meta`, as ratios of the root (D7). Not the six-rung absolute-px candidate: at a 13px base there is no room between 12 and 13 for a fifth and sixth step, and absolute px cannot follow a root that moves | — |
| ~~Q7~~ | ~~Import the tokens, or migrate 290 sites?~~ — **answered, and the question was wrong**: Studio was never falling back to Tailwind's defaults. It carried its **own six-rung `@theme` ladder** (`--text-xs` … `--text-2xl`, a "VS Code web font scale") which overrode the kit's, so the import alone changed nothing. A0 is therefore *delete Studio's ladder*, and the import is what fills the hole. Its colour `@theme inline` map went too — the kit's `@theme` registers those tokens once it is compiled as source. Measured: body 10.6px → 13px, `text-sm` 9.8px → 13px, `text-xs` 8.9px → 12px | ✅ A0 |
| Q8 | The 606 `text-sm`/`text-xs` uses in design-kit's own **stories** render correctly but now contradict the rule they are meant to demonstrate. One pass, or leave them? | Phase 1 |
| Q4 | Which canvas-ui inventions get promoted down to `@invana/ui` (`DetailCard` → `PropertyList`, `Panel` chrome, status bar), and does canvas-ui adopt them in the same release? | Phase 2 |
| Q9 | **`border-<colour>` utilities are not emitted.** `border-destructive` lands in the class list — twMerge correctly drops `border-input` — and still computes grey, because the build generates no such utility, while `text-destructive` in the same file works. Two files now carry the same token-inline workaround (`style={{ borderColor: "var(--color-destructive)" }}`): `TaskGantt`'s error band and `ParamRow`'s invalid value. **Fix the build, then delete both.** Every invalid/danger border in the kit is silently grey until someone does | `@invana/styling` |
| Q10 | **`pnpm type-check` checks nothing in `forms`, `editor` and `dashboard`.** Their root `tsconfig.json` is `{"files": [], "references": [...]}`, so bare `tsc --noEmit` compiles zero files and exits `0` — a file containing `const x: number = "nope"` passes. The real invocation is `tsc -p tsconfig.lib.json --noEmit`, and it surfaces a second pre-existing problem: `@invana/ui`'s `typography/index.ts` imports with `.tsx` extensions, which every package consuming ui through the source `paths` mapping rejects (`TS5097`) because only ui's own tsconfig sets `allowImportingTsExtensions`. Both predate this work — verified by stashing. Fix the scripts, then the extensions | every package but `ui` |

## 7. Operate › Runs — what the 16 artboards need

Audit of `.design/canvas-govern-agents/rd.py` (the 16 `operate.runs.*` artboards, listed one by one
in [the-screens.md](../the-screens.md#operate--runs--the-16-artboards)) against the kit at
`0.0.23+`. The journal, the run's four readings and the step's three readings are **one dashboard
shell over one record** ([SR46](../modules/operate/features/see-what-ran.md#decisions) ·
[SR55](../modules/operate/features/see-what-ran.md#decisions)), so most of the page is already the
kit's: `PanelStack` · `PanelBox` · `RecordHeader` · `MetricTile` · `PropertyList` · `LayerSection` ·
`LensRow` · `AddressChip` · `LayerChip` · `Terminal` · `CodeBlock` · `TaskGantt` · `EmptyState` ·
`AppStatusBar`, and `@invana/dashboard`'s `metrics · properties · json · code · table · log` panels.

What follows is the gap — **11 new components, 5 extensions, 7 dashboard panel kinds and 3 canvas
items**. Nothing here is a screen; each row is a drawing the boards repeat. The same list as a
**queue with status**, one row per component, is [components-todo.md](components-todo.md) — this
section is the map and the reasoning, that file is what is still owed.

### 7.0 What shipped, and what the build changed about this list

**30 of 31 rows are ✅** — 13 new components, 5 kit extensions, 8 dashboard panel kinds and the three
canvas items. Four things the build settled that this section had guessed at:

| Guess | What shipped |
|---|---|
| Seven new **built-in** dashboard kinds | They ship as **`RUN_PANELS`**, a registry a consumer merges (`<Dashboard registry={RUN_PANELS} />`). `BUILT_IN_PANELS` is eleven kinds two unrelated surfaces each need; these are one surface family's |
| Re-point the built-in `exchange` at `ExchangeRecord` | Left alone, and the settled ask is a **new** kind, `clarification`. `exchange` draws an exchange of *documents* — a request and a response, as code; a clarification is a question, its options and who chose. Two drawings, two kinds |
| Three new `canvas-ui` components | **All three were recipes** over primitives the canvas already ships — a gate is an `EdgeBadge`, read-only is an unmounted `DragNodeBehaviour`, and the labelled loop-back edge already existed. Proven by one story, `Designs › Run flow`, in the canvas repo |
| Nothing about the Lens rows | They needed a thirteenth component, **`ParticipantRow`** — `LensRow` is a *world* in a drawer, and nothing drew a participant's verdict. Found by building D6 |

Two defects **rendering** found that type-check and build could not, in the same voice as the three
under *Shipped — Govern K1–K11*: `RecordHeader` truncated every crumb equally, so
`runs › run:7d3184f1 › step:…` rendered as `ru… › run:7d3184… › step:…` and lost the kind prefix
[SR54](../modules/operate/features/see-what-ran.md#decisions) exists to carry; and `TraceLoop`'s
tone painted **every step name inside the loop** in the bound's colour, which said the rounds failed
when what was being marked is that they repeated.

### 7.1 New — primitive (`packages/ui/src/components/ui/`)

| Component | What it is | Boards | Why not what exists |
|---|---|---|---|
| `SegmentedControl` | the reading switch — `In order · Layers · Flow · Lens`, `Overview · Touched · Log`, `All · Info · Warn · Error`. Single-select, bordered frame, active filled, sized by its widest option | 16 | `ToggleGroup` ships `default`/`outline` toggles with no shared frame, and `Tabs size="sm"` is a pill strip that owns a panel. A reading switch selects a *reading of one page*, so it sits in the pagehead's action slot, not over a tab body |

### 7.2 New — composites (`ui-extended`)

| Component | What it draws | Boards | Decision it renders |
|---|---|---|---|
| `TraceList` · `TraceStep` · `TraceLoop` · `TraceGate` | the `In order` reading. A row is a step: layer stripe · seq · key + description · mark · layer + role · duration + note. `depth` nests a delegated run's steps under the step that spawned it; `live · queued · dim · struck · selected` are its states. A loop is a **box around** its rounds; a gate is a **rule between** rows, its chip on the side the cost falls on | in_order · in_order.card · in_order.states | [SR47](../modules/operate/features/see-what-ran.md#decisions) · [SR48](../modules/operate/features/see-what-ran.md#decisions) |
| `TouchStrip` | one cell per layer — dot, name, count — struck when refused, dim when allowed and never touched; header states `declared 4 · touched 4 · refused 1`. The summary question that stopped costing an axis | in_order · in_order.card · the run drawer (`orientation="column"`: one line per layer, note right) | [SR47](../modules/operate/features/see-what-ran.md#decisions) · [SR67](../modules/operate/features/see-what-ran.md#decisions) |
| `RunRow` · `StatusIcon` | the journal row in `leftSection`: status glyph · what it was about (mono for a query) · mono id · plan · meta, `depth` for a child run, no badge | every board (the panel) · list | [SR45](../modules/operate/features/see-what-ran.md#decisions) · [SR65](../modules/operate/features/see-what-ran.md#decisions) · retires Studio's `WorkRow` in the journal (DS17) |
| `KindChip` | `ask · import · bulk · stitch · enrich` — the one vocabulary the journal filters on | list · list.states | [SR7](../modules/operate/features/see-what-ran.md#decisions) — one journal, never a panel per kind |
| `MarkChip` | the micro-mark a row carries: `↺ 2 of 3` · `⏸ 1 of 3` · `↳ delegates` · `live` · `no answer` · `stopped`. Mono, outlined, toned | in_order · in_order.states | a *run-time* mark, where `BoundChip` draws a **declared** bound |
| `AttemptClock` | `queued · attempt 1 · attempt 2 · settled`, each with started · took · what happened, the timed-out attempt **struck in place**, and `elapsed against working` on the side | step · step.states · step.exchange | [SR56](../modules/operate/features/see-what-ran.md#decisions) — `RetryNote` is one line on an emission, not a step's clock |
| `ArtifactTable` | `file · kind · size · digest · written` + `Open` · `Download`; the digest is the address, eight characters, mono; a file retention dropped is struck | step.touched · step.touched.write · step.states | [SR58](../modules/operate/features/see-what-ran.md#decisions) |
| `AbsenceNote` | *nobody recorded one* · *purged by retention* · *the step declared `read_only: true`* — three different facts, none of them an empty table | step.touched · step.states · in_order.states | [SR34](../modules/operate/features/see-what-ran.md#decisions) · [SR59](../modules/operate/features/see-what-ran.md#decisions) · [O6](../modules/operate/spec.md) |
| `ExchangeRecord` | the settled ask: the agent's question, the options with the chosen one marked, who answered and after how long | step.exchange | [SR55](../modules/operate/features/see-what-ran.md#decisions) — `ClarifyCard` is the **live** ask, and a settled one is a record, not a control |
| `RecordPager` | `‹ ›` with `step 7 of 9`, in the pagehead | 5 step boards | [SR54](../modules/operate/features/see-what-ran.md#decisions) — a reader walks the run without returning to the list |
| `RunStatusText` | `succeeded · running · cannot_answer · awaiting_approval · queued · cancelled · failed`, each on its own token, as a table cell and as a chip | list · list.states · every pagehead | the status vocabulary is the engine's; a per-call-site `<span style="color">` is how two screens disagree |

### 7.3 Extend what exists

| Component | Package | Change | Boards |
|---|---|---|---|
| `LayerStrip` | `@invana/ui` | **the forecast reading**: `p50` drawn **on** the bar with its Δ, band notes (`3 calls, all inside p95`), and a seam that has **no estimate** — dashed, stating so beside its actual. `scale="elapsed"`, frozen labels, brackets, seams and struck refusals already ship (K11) | layers · layers.forecast |
| `DataTable` | `@invana/tables` | **indent rows** (a child run under its parent), **row selection** (accent + inset rule), and cell readings — mono · tone · struck. `density="compact"` and `groupBy` already ship. **Studio does not depend on `@invana/tables` yet** — install it | list · list.states · step · step.touched* |
| `Legend` | `@invana/ui` | swatch kinds `stripe` (the layer bar), `bracket` (a bounded repetition), `rule` (a gate). Today: dot · line · dashed · arrow · ring | in_order · layers · layers.forecast · flow |
| `FilterBar` / `FilterChip` | `@invana/ui` | a **closable** chip (`since: today ×`) and the bar's own summary (`interactive runs hidden`) | list · list.states · every panel |
| `TaskNode` | `@invana/ui` | `readOnly` — a run's picked node gets the ring and **no handles**; handles belong to the draft canvas | flow · flow.step ([SR52](../modules/operate/features/see-what-ran.md#decisions)) |

### 7.4 `@invana/dashboard` — the panel kinds a run page is made of

A run page is `board.kind = run` ([CV12](../modules/explore/features/boards.md)), so every band above
reaches Studio as a panel spec, not as a hand-composed page.

| Kind | Renders | Note |
|---|---|---|
| `trace` | `TraceList` | the `In order` reading |
| `touched` | `TouchStrip` | the summary strip, not an axis |
| `attempts` | `AttemptClock` | |
| `artifacts` | `ArtifactTable` | |
| `layers` | `LayerStrip` | `gantt` stays `TaskGantt`; the two are different drawings and both are wanted |
| `lens` | `LayerSection` + `LensRow` | already kit components; the panel kind is what is missing |
| `exchange` | `ExchangeRecord` | **today it renders a label and a `CodeBlock`** — which is not what the board draws |

A panel whose record nobody wrote **does not render**; a panel retention purged renders
`AbsenceNote`. That is a `Dashboard` rule, not a per-panel one (SR34).

### 7.5 Not design-kit — `@invana/canvas-ui`

| What | Note |
|---|---|
| `GateMarker` | the approval mark placed on the flow, between the node it holds and the one before it | 
| read-only flow | the run paints status onto the plan it ran: `TaskNode readOnly`, no drag, `Open the step` on the picked card (`DetailCard` already covers the card) |
| a dashed, labelled loop-back edge | `round 2 — the loop went back once`, drawn under the row it returns to |

### 7.6 Build order

| # | Ships | Unlocks |
|---|---|---|
| 1 | `SegmentedControl` · `RunRow` · `KindChip` · `RunStatusText` · `DataTable` indent + selection · `FilterChip` closable | the journal and every pagehead — 16 boards' chrome |
| 2 | `TraceList` family · `TouchStrip` · `MarkChip` · `Legend` swatches | `In order`, the default reading — 3 boards |
| 3 | `LayerStrip` forecast | `Layers` and `Layers · forecast` — 2 boards |
| 4 | `AttemptClock` · `ArtifactTable` · `AbsenceNote` · `RecordPager` · `ExchangeRecord` | the step's three readings, its two kinds and its six states — 5 boards |
| 5 | the seven `@invana/dashboard` panel kinds | the run and step pages as specs rather than pages |
| 6 | `GateMarker` · read-only flow · the labelled loop edge (canvas repo) | `Flow` and `Flow · step` — 2 boards |

Every new component ships **with a story** in `apps/storybook/stories/ui/…`, one exported story per
file, mirroring `packages/ui/src/components/`. A screen is not a story — the screens stay on the
canvas.

### 7.7 What Studio composes, now the kit ships the panels

The kit's run panels reach Studio as **`RUN_PANELS`**, merged into three registries: the run page,
the step page, and `shared/dashboardPanels.ts` — the last because a **frozen report** renders
whatever document was kept and needs every renderer a document could name
([B16](../building-engine/boards-migration.md)).

| Kind | Drawn by | Composed by | Note |
|---|---|---|---|
| `layers` | the kit | `govern/runLayers.ts` | the composer stays in Studio: how a `TouchesResponse` and a trace become bands and bars is not something `@invana/dashboard` can know. A run with no ledger draws `absent: unrecorded`, never an empty axis ([SR34](../modules/operate/features/see-what-ran.md#decisions)) |
| `lens` | the kit | `govern/runLens.ts` | one section per layer, a `ParticipantRow` per address ([SR53](../modules/operate/features/see-what-ran.md#decisions)). The layer is the **address's first segment**, the engine's own split, so an allowed-and-never-touched participant still bands correctly |
| `flow` | Studio | `operate/dashboards/TaskFlowPanel.tsx` | the one kind Studio still owns — a plan on a canvas is `@invana/canvas`, which a dashboard package does not depend on |
| `stepTouch` | Studio | `govern/StepTouchPanel.tsx` | **not** the kit's `touched`: that is `TouchStrip`, the run's summary strip. This is the step's forensic reading — generated vs executed digests, the slice composed in, what egress cut — and the kit ships no kind for it |
| `runLens` | Studio, legacy | — | kept **only** for reports frozen before the swap. Nothing new registers it; delete the file once no stored board names the kind |

Two Studio names shadowed kit exports and are gone: the `RunRow` **type** in `hooks/queries/useRuns.ts`
is `JournalRow` (the kit's `RunRow` is the journal row *component*, which the list will draw), and
`LayersOptions` · `RunLensOptions` are the kit's own option types now
([DS17](../modules/platform/features/design-system.md)).
