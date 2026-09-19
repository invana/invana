# Refactor plan — how Studio moves to the new shape

The *what* is [`code-shape.md`](code-shape.md): feature modules, the deletion lists, the
route map, the guardrails. This is the *how* — the mechanics of getting there without breaking a
product that has no unit tests, and the substitution table for the components `@invana/ui@0.0.23`
and `@invana/canvas-ui@0.0.14` now own.

---

## 1. The safety net comes first, and it is `tsc`

There are **no unit tests** and two Playwright specs. For a refactor that is mostly *moves and
substitutions*, that is survivable — but only if the type checker is honest, and today it is not:

| | Was | Now — **Phase 1 is done** |
|---|---|---|
| `pnpm check-types` | `tsc --noEmit` against a `{"files": []}` root config — **compiled nothing** | ✅ `tsc -b --noEmit`. Proved with a deliberate error, which it caught |
| `pnpm build` | 26 errors | ✅ 0 |
| `pnpm lint` | green | ✅ green |
| `pnpm dev` | — | ✅ serves 200 |
| e2e | 2 specs | not run — they need the engine and an auth state; run them at every phase boundary from here |

A move that breaks an import is a compile error. A substitution that drops a prop is a compile
error. **That is the whole net**, so it goes up before anything moves. Nothing in Phase 2 onward
starts until `pnpm build` is green.

### 1.1 The 26, and what each turned out to be — ✅ all fixed

Bigger on paper than in the editor: 16 of them were one wrong type annotation, twice.

| # | Where | Real fix |
|---|---|---|
| 14 | `WorkGraphCanvas.tsx` `NODE_STYLE` / `EDGE_STYLE` | The annotations said `NodeStyle` / `EdgeStyle`; the fields are function resolvers, which is `ResolvableNodeStyle<GraphNode>` / `ResolvableEdgeStyle<GraphEdge>`. **Two annotation changes, 14 errors** |
| 2 | `SchemaCanvas.tsx` | Same |
| 3 | `visibility.ts` · `ExplorerTypesPanel.tsx` | `GraphStore.getNodes` → `nodes()`, which returns an `IterableIterator<GraphNode>`. Superseded in Phase 2, when the file goes for the store's native `hideNodes`/`showNodes`/`isNodeHidden` |
| 3 | `run.store.ts` | Defaults written *before* the spreads meant to layer over them. Extracted to a `freshView()` factory and spread first — a factory, not a constant, because one shared `steps: []` across every run is a cross-talk bug |
| 2 | `PropertyEditor.tsx` | A `readonly string[]` assigned to `string[]`; copy with `[...xs]` at the boundary |
| 2 | `SessionTasksView.tsx` | `Turn.clarifications` was annotated singular while its producer (`Timeline`) and consumer (`StepList`) are both plural — a stale annotation, and the only genuine defect in the 26. Corrected to the plural |
| 2 | `GraphCreatePage.tsx` · `GraphForm.tsx` | `react-hook-form`'s `Control` is invariant in its field-values parameter, so `Control<FormShape>` will not assign to `ObjectFieldProps`' `Control<any>`. **The real fix is in `@invana/forms`** — make `ObjectField` generic in `TFieldValues`. Until it ships (DS3), one cast at each of the two call sites, each carrying that sentence |
| 1 | `useEventStream.ts` | `useAuth()` reads the token but does not return it. Now read from `auth.store` with a selector, rather than widening `useAuth`'s surface for one caller |
| 1 | `ExplorerPage.tsx` | The `Record<string, unknown>` → `CanvasStateSnapshot` cast is now an `isCanvasStateSnapshot` guard. A state written by an older engine is refused with a toast instead of throwing inside the renderer |
| 1 | `WorkGraphCanvas.tsx` | `layers.get()` is typed `ILayer`; only a world layer has an extent. Narrowed with `instanceof WorldLayer`, which is how the engine duck-types it |
| 1 | `CanvasesPanel.tsx` | Dead file — deleted, error went with it |

**One follow-up this created**: `@invana/forms` `ObjectField` should be generic in `TFieldValues`.
Until it is, two Studio call sites carry a cast that a kit change would delete.

---

## 2. Substitutions — what `ui` and `canvas-ui` now own

The refactor is mostly deletion. Each row is *delete the Studio file, import the component*.

### 2.1 From `@invana/ui@0.0.23`

| Studio | Lines | Becomes |
|---|---|---|
| ~~`work/PanelChrome.tsx`~~ | ~~564~~ | ✅ **deleted** — see [design-kit-coverage.md](design-kit-coverage.md) §6a |
| `emissions/TemplatesPanel.tsx` | 323 | `TemplatePicker` |
| `emissions/EmissionCard.tsx` | 225 | `EmissionCard` + `EmissionHeader` + `CitationMarker` |
| `emissions/NotAnAnswer.tsx` | 169 | `CannotAnswerCard` + `DiagnosisCard` + `RepairNote` + `RetryNote` |
| `work/DetailRows.tsx` | 167 | `PropertyList` + `PropertyRow` |
| `work/WorkRow.tsx` | 138 | `Item size="xs"` + `StatusDot` + `Badge tone` |
| `explorer/ResultsTable.tsx` | 83 | `Table density="compact"` |
| `graphs/components/GraphStatusBar.tsx` | 48 | `AppStatusBar` |
| `explorer/SessionSteps.tsx` | 398 | `ChatSessionTaskRow` + `ChatSessionTaskGroup` + `ChatSessionDisclosure` + `ChatSessionActivitySubLine` |
| `explorer/SessionTurn.tsx` | 520 | `ChatSessionMessage` + `ChatSessionPromptRow` + `EmissionCard` |
| `explorer/SessionList.tsx` | 343 | `Item size="xs"` + `SectionHeader` |
| `explorer/ListPanel.tsx` | 329 | `Item size="xs"` + `FilterBar` |
| `explorer/TraceDialog.tsx` | 388 | `Sheet` + `TimelineList` + `PropertyList` + `StatusDot` |
| `explorer/SessionComposer.tsx` | 686 | `ChatSessionComposer` + `ChatSessionContextChip`; the editor half → `@invana/editor` |

### 2.2 From `@invana/canvas-ui@0.0.14`

Released this week, and it took the React components with it — `CanvasMessageBar`, `GraphStatusBar`,
the three context menus, `ToolbarItem(s)` and `applyIconOverrides` left `@invana/canvas-react`.

| Studio | Lines | Becomes |
|---|---|---|
| `explorer/LayersPanel.tsx` | 646 | `LayersViewPanel` |
| `explorer/ExpandFineTunePanel.tsx` | 418 | `CanvasFiltersViewPanel` + `FindInCanvasViewPanel` |
| `modeller/PropertyEditor.tsx` | 415 | `PropertiesEditor` |
| `explorer/CanvasTabsBar.tsx` | 269 | `BoardPagesViewPanel`, and with it the four-branch ternary in `mainSection`. The layout is the small half; extracting a `DataBoardPage` that owns one board's state is the work. See [the-shell.md](the-shell.md) › *The Explorer's main region is a page host already* |
| `work/WorkCanvasChrome.tsx` | 193 | `CanvasMessageBar` + `GraphLegendLayerEditorPanel` |
| `explorer/InspectorPanel.tsx` | 178 | `InspectorPanel` + `NodeDetailView` + `EdgeDetailView` |
| `explorer/StylingPanel.tsx` | — | `NodeStyleEditorPanel` + `NodeStylingEditorPanel` + `ThemeEditorPanel` |
| `explorer/lib/visibility.ts` | — | The store: `hideNodes` · `showNodes` · `isNodeHidden` · `hideNodesByPredicate` · `showAllHidden` |

****Installing canvas-ui pulls four more packages.** `canvas-react@0.0.12` statically imports
`@invana/renderer-pixijs`, `graph-layer-d3-contour`, `graph-layer-maplibre` and
`graph-layout-d3-sankey`. Four of the five are declared **optional** peers, which is wrong for how
the bundle is built — a top-level `import … from` of an optional peer means the package cannot load
without it, so a consumer gets `Could not resolve "@invana/graph-layer-d3-contour"` rather than
graceful degradation. **Upstream fix**: either drop `optional` from `peerDependenciesMeta`, or move
those five behind dynamic `import()` so the optional flag means something. Until then Studio
installs all four; they are tree-shaken out of `dist/`, so the cost is `node_modules` only.

**`<Canvas>` no longer provides the graph context.** In canvas 0.0.11 the `<Canvas>` root provided
`GraphCanvasContext` itself; 0.0.12 moved that onto **`<GraphCanvas>`**, which instantiates the graph
engine and provides *both* `CanvasContext` and `GraphCanvasContext`. Props are identical
(`GraphCanvasProps = CanvasRootProps`), so adopting it is a one-word change — but a child calling
`useGraphCanvas()` under a plain `<Canvas>` now **throws at render**, and nothing at the type level
says so. Studio has **three** canvases and all three called the graph hooks under a plain `<Canvas>`:
`SchemaCanvas.tsx` (the one that surfaced it), `ExplorerCanvas.tsx` and `WorkGraphCanvas.tsx`. All
three now root on `<GraphCanvas>`, imported under its own name — no `as CanvasRoot` alias, because
the component's name is the thing that matters here. Any new canvas whose children use the graph
hooks roots on `<GraphCanvas>`.

`BoardPagesViewPanel` is the one to study — [the-shell.md](the-shell.md) is the contract it fixes.** It renders the tab strip *and* the page bodies as one
column, and `keepMounted` means a tab switch is visibility, not a remount — each board keeps its
camera, layout and selection. It replaces `CanvasTabsBar` *and* the canvas-tab state in
`ExplorerPage`. The reference is `canvas-ui/apps/AppLayoutV2` in the canvas Storybook: the canvas-side
twin of `Themes/AppV2 › ExplorerShell`.

### 2.3 The rule for every substitution

A kit component that does not fit is a **kit gap**, and it is closed in the kit (DS1 · C2). It is not
closed with a `!`-override, a wrapper that re-implements half of it, or a fork. Three questions, in
order:

1. Does the kit component do this already? → use it.
2. Does it need a prop the kit could reasonably own? → add it in design-kit, with a story, release, bump.
3. Does it need a *domain type* in its props? → then it belongs in Studio (DS2) — build it in the feature module, composed from kit primitives.

If a substitution takes more than an afternoon, it is question 2 wearing a disguise.

### 2.4 Forms — the generator owns them, once it can validate

`@invana/forms` ships a **form generator**: `ObjectField` renders a whole form from a
`FieldConfig[]` — types, labels, descriptions, placeholders, options, groups, rows, column spans,
sizes. The kit's own stories are filed under *Form Generator*. Studio should be describing forms,
not writing fields.

Today it mostly writes fields.

| | Files | Fields | |
|---|---|---|---|
| Uses the generator | 1 | — | `GraphForm.tsx` |
| **Hand-written, and genuinely a form** | **11** | **89** | ProfileSettings 18 · LLMs 13 · NodeType 10 · EdgeType 9 · Skills 8 · PropertyKey 6 · Model 6 · DeclareLink 6 · Login 5 · CanvasForm 4 · Concurrency 4 |
| Hand-written, and **not** a form | 6 | 27 | ExpandFineTune 13 · Templates 6 · PropertyEditor 3 · SessionComposer 3 · CompatibilityBanner 1 · ImportModel 1 |

The second row is the generator's. The third is **not** — those are canvas parameter panels, a chat
composer and single controls, and they already have destinations in §2.1/§2.2
(`CanvasFiltersViewPanel`, `TemplatePicker`, `PropertiesEditor`, `ChatSessionComposer`). A form
generator is for forms; pointing it at a canvas inspector would be the same mistake in the other
direction.

### 2.5 Why `react-hook-form` is imported at all — and the three kit gaps

`@invana/forms` already re-exports `Control` · `DefaultValues` · `FieldValues` · `Mode` ·
`SubmitHandler` · `UseFormReturn`, so Studio never needed `react-hook-form` for a *type*. Two call
sites were importing them from `react-hook-form` anyway; **fixed** — the import is now three files,
each taking only `useForm`.

| # | Gap in `@invana/forms` | Consequence in Studio | Size |
|---|---|---|---|
| **F1** | `useForm` is not re-exported (it is a value; only types are) | `react-hook-form` stays in three Studio imports. It also stays in `package.json` regardless — the kit declares it a **peer**, so Studio must install it either way | One line |
| **F2** | `ObjectFieldProps.control` is `Control<any>`, and RHF's `Control` is invariant in its field-values parameter | `Control<FormShape>` will not assign, so two call sites carry a cast | Make `ObjectField` generic in `TFieldValues` |
| **F3** | `FieldConfig` has **no validation** — no `required`, `rules`, `validate`, `disabled`, `readOnly` | **This is the real blocker.** `GraphForm`, the one generator user, validates by calling `form.setError` by hand at submit time — so errors appear on submit rather than on blur, and the rule lives far from the field it governs. Converting eleven more forms to that pattern would spread it, not fix it | The one that needs design |

**So the order is F3 first, not the conversions.** Replacing eleven hand-written forms today would
trade ~90 fields of markup for ~90 fields of `setError` — a real reduction in lines and a real
regression in behaviour. The forms are not blocking anything; the generator that can validate is
worth waiting for.

| Step | Work | Where |
|---|---|---|
| 1 | F1 + F2 — a re-export and a generic. Release | design-kit |
| 2 | F3 — `FieldConfig` gains `required` · `rules` · `disabled` · `readOnly`, resolved through RHF's own field rules so errors land on the field. One story per state | design-kit |
| 3 | Convert the 11, one file per commit, each ending with the form's validation *described* rather than executed | Studio, Phase 2 |
| 4 | Drop the two casts and the three `useForm` imports | Studio |

Steps 1–2 are the answer to "why is `react-hook-form` in Studio at all": because the kit does not
yet own the two things a caller cannot do without — creating the form, and validating it.

---

## 3. Mechanics of a safe move

Phase 3 moves ~150 files. The discipline that keeps it reviewable:

| Rule | Why |
|---|---|
| **`git mv`, one module per commit** | The diff shows renames, not rewrites. A reviewer reads the module list, not 6,000 lines |
| **No logic changes in a move commit** | A move that also "tidies while I'm here" cannot be reverted cleanly. Substitutions are Phase 2, moves are Phase 3, and they never share a commit |
| **Imports fixed by the compiler, not by hand** | Move, run `tsc -b`, fix what it names, `biome check --write` for ordering. Anything `tsc` does not catch was not type-safe to begin with |
| **`index.ts` written last** | Move the files, get it compiling, *then* decide what the module exports. Writing the barrel first invents a public surface nobody asked for |
| **e2e at every module boundary** | Two specs, ~40 seconds. They catch the class of breakage `tsc` cannot: a route that no longer renders |

### 3.1 Order within Phase 3

Leaf-first, so a module never moves while something it owns is still elsewhere.

| Step | Module | Why here |
|---|---|---|
| 1 | `shared/` | Everything imports it; moving it first means every later move fixes its imports once |
| 2 | `app/` | Router, shell, providers. Small, and it fixes the entry point early |
| 3 | `identity-and-access` · `operate` | Genuinely self-contained. They prove the module contract on something low-risk |
| 4 | `agents` · `skills` · `task_plans` · `work` | The `work/` panels, one module each. Already near-separable |
| 5 | `bring-data-in` · `connect-and-model` | The model canvas is the risk here — move it with its components in one commit |
| 6 | `ask` | The answer surface. Substituted in Phase 2, so it moves as kit compositions rather than as 1,700 lines |
| 7 | `explore` | Last, and biggest. `ExplorerPage.tsx` is decomposed *as* it moves — see below |
| 8 | `graphs` | The shell that hosts the rest; correct once its tenants have left |

### 3.2 Decomposing `ExplorerPage.tsx`

2,222 lines is the hardest single file. It is not refactored in place — it is **emptied by the
phases before it**:

| What leaves it | To | When |
|---|---|---|
| Canvas tab state and the strip | the strip is `BoardPagesViewPanel` (done); the state goes to `features/canvases/{usePages,useCanvasTabs}` | Phase 2 |
| The five work panels it imports and switches on | their own modules, reached by route | Phase 4 |
| Panel/region layout | `AppLayoutV2` regions via `app/shell/` | Phase 5 |
| Canvas wiring | `features/explorer/` (already separate) | Phase 3 |
| Session/assistant state | `features/ask/assistant/` (already separate) | Phase 3 |

What should remain is a screen that composes: a canvas, a left panel, an inspector, a console. If it
is still over 400 lines at the end, something in the list above did not actually leave.

---

## 4. How the code is written

The structural rules are in recommendation.md §4.1. These are about the code inside a file.

| Rule | Detail |
|---|---|
| **A component renders; a hook decides** | Data fetching, URL sync and derived state live in `queries.ts` or a hook. A screen file that contains a `useEffect` chain is a hook that has not been extracted yet |
| **Props take what the component shows, not where it came from** | `<AgentRow agent={a} />`, not `<AgentRow agentId={id} />` with a fetch inside. One fetch per screen, at the top |
| **No `any`, and no `as` across a real boundary** | A cast at an API edge is a missing type guard. `ExplorerPage`'s `CanvasStateSnapshot` cast is the example to not repeat |
| **Name for the domain, in the product's words** | `terminology.md` pins them. A `Run` is not a "job"; an `Emission` is not a "result card" |
| **Comments say *why*** | The existing code does this well and it is worth keeping — the comment on `AppLayoutV2`'s stable main position is why that bug stayed fixed |
| **Empty, loading and error are not afterruns** | Every screen renders all three, and `EmptyState` names what unlocks it (DS15). A screen that only handles the happy path is half a screen |
| **One `index.ts`, no barrel chains** | A module's barrel re-exports from files, never from another barrel. Barrel chains defeat tree-shaking and make cycles invisible |
| **Delete rather than deprecate** | No `// TODO: remove after`, no `.old.tsx`. Git has the history; the tree should have one answer |

### 4.1 Tests, where they earn it

Not 80% of 42 screens. Per module: the query hooks, the URL ↔ state mapping, and any function the
type checker just caught being wrong (`SessionTasksView`'s clarification map is the first). Vitest
lands in Phase 1 so the harness exists before there is anything to put in it.

---

## 5. Done, per phase

Every phase ends with `pnpm build`, `pnpm check-types`, `pnpm lint` and both e2e specs green. Beyond
that:

| Phase | Also done when |
|---|---|
| 1 · Sweep | 26 errors → 0; `check-types` compiles `src`; `knip` reports no unused files; `rbush`/`d3-force`/`immer` gone |
| 2 · Substitute | No Studio component shares a name with a kit export; `@invana/canvas-ui` is imported, not imitated; ~4,300 lines are imports |
| 3 · Move | `git log --stat` shows renames; every module has an `index.ts`; no cross-module deep import |
| 4 · Route | Every surface has a URL; a reload lands on the same screen; the Explorer chunk is one of many |
| 5 · Shell | A panel toggle does not remount the canvas; S12f closes |
| 6 · Kit gaps | No `!` override in Studio or in the `ExplorerShell` story |
| 7 · Screens | Every artboard has a route, ✅ or 🖼 in the index |

---

## 6. What this does not do

| Not doing | Because |
|---|---|
| Rewriting the canvas integration | It works, it is already isolated, and 0.0.12 is a bump not a redesign |
| A state-management change | Zustand + TanStack Query is fine. Moving files does not need a new store |
| Chasing 80% coverage | §4.1 — tests where the type checker found something, not everywhere |
| Touching the engine | This is `studio/` only |

---

## 7. The rename — one word per region

The vocabulary is settled in [the-shell.md § The regions](the-shell.md#the-regions--and-their-names).
This is the mechanical inventory of what still says something else. It is a rename, not a redesign:
no behaviour changes, and every step is a `tsc`-checked symbol move (§1).

### 7.1 `design-kit` — first, because it owns the names

`AppLayoutV2`'s **props** are already right. Its **internals** are not, and they are where the old
words leak back into every consumer that reads a DOM id or a story.

| `packages/themes/src/app-v2/layout.tsx` | Now | → |
|---|---|---|
| panel id | `sidebar-panel` | `left-section` |
| panel id | `editor-panel` | `main-section` |
| panel id | `auxiliary-panel` | `right-section` |
| panel id | `terminal-panel` | `bottom-section` |
| panel id | `editor-area` · `editor-horizontal` | `main-area` · `main-row` |
| local | `sidebarPanel` · `editorPanel` · `rightPanel` · `bottomPanel` | `leftSectionPanel` · `mainSectionPanel` · `rightSectionPanel` · `bottomSectionPanel` |
| const | `DEFAULT_SIDEBAR` · `DEFAULT_EDITOR` · `DEFAULT_AUXILIARY` · `DEFAULT_TERMINAL` | `DEFAULT_LEFT` · `DEFAULT_MAIN` · `DEFAULT_RIGHT` · `DEFAULT_BOTTOM` |
| JSDoc | "the left activity bar", "the sidebar (left) panel", "the auxiliary (right) panel", "the bottom (terminal) panel" | the region name |
| `app-v1/layout.tsx` JSDoc | "The left activity bar" | `leftNav` |

The `bottomSpan` values (`left-main` · `main-right` · `main` · `full`) and the span area ids
(`left-main-area`, `main-right-area`, `main-center-area`) stay — they name a *span*, not a region,
and they are already built from the region words.

**One caveat.** `react-resizable-panels` keys persisted sizes by panel id, so renaming the ids
resets a stored layout once, for anyone who had one. Studio passes `idPrefix="graph-detail"` and the
kit's story passes `storageKey={null}`, so the blast radius is one reset of column widths — worth a
changeset line, not a migration.

### 7.2 `canvas-ui` — `rail` means `header` there

| `packages/canvas-ui/src/` | Now | → |
|---|---|---|
| `apps/GraphCanvasApp.tsx` | "header rail" · "footer rail" · "no left rail" (×15) | `header` · `footer` · "no `leftNav`" |
| `apps/GraphCanvasAppHeader.tsx` · `…Footer.tsx` | "Header rail builder" · "the rail's height" | `header` · "the `header`'s height" |
| `toolbars/ExportStateToolbar.tsx` · `ClearCanvasToolbar.tsx` | "header rail" | `header` |
| `components/styles.ts` · `editor-panels/…` | "design-kit sidebar nav-item" | "`leftNav` item" |

All of it is comments and JSDoc — no exported symbol carries the word, so this is a prose pass with
no consumer impact.

### 7.3 `studio/` — the bulk of it

| File | Now | → |
|---|---|---|
| `shell/useGraphLeftNav.tsx` | `rail` ×20 in prose · `railItem` | `leftNav` · `navItem` |
| `shell/useSettingsPanel.ts` | `useSettingsPanel` | `useLeftSection` |
| | `SettingsSection` | `LeftSectionKey` |
| | `DEFAULT_SECTION` · `KNOWN_SECTIONS` | `DEFAULT_KEY` · `KNOWN_KEYS` |
| | `PANEL_PARAM = "panel"` | `LEFT_PARAM = "left"`, with `panel` + `settings` as legacy reads |
| `shell/GraphDetail.tsx` | `PAGE_OWNED_SECTIONS` · `ALL_NATIVE_SECTIONS` | `PAGE_OWNED_KEYS` · `NATIVE_KEYS` |
| | `headerRightExtras` · `footerRightExtras` | `headerRight` · `footerRight` |
| | `statusMetrics` | `footerMetrics` |
| | `headerPanelControls` | dropped — the toggles move to `BoardPagesViewPanel`'s `headerActions` ([the-shell.md](the-shell.md)) |
| `shell/ConnectionStatusBar.tsx` | `ConnectionStatusBar` | `ConnectionStatus` — the `footer` *is* the bar |
| `features/explore/assistant/` → **`features/ask/assistant/`** | `AssistantDrawer` · `AssistantDrawerShell` · `useAssistantDrawer` | ✅ done — the shell is **deleted** (its attachment chip belongs to the composer, AD10) and the hook is `shell/useRightSection`. A region hook lives with the region, beside `useSettingsPanel`, not inside one of its occupants |
| `components/header/UserMenu.tsx` | "rail" | `leftNav` |

### 7.3a The two params that are not renames

Validated against the code: **`?page=` does not exist**, and `?ai=` was a boolean, not an occupant
key. So two of the four params in [the-shell.md](the-shell.md#where-the-names-travel) are new state,
and they are the part of this work that is not mechanical. `?right=` is **done**; `?main=` is not.

| Region | Owner today | → |
|---|---|---|
| `mainSection` | `activePageId` is derived from `globalModelOpen` · `workKind` · `workCanvas` · `activeCanvasId`, and `selectPage(id)` dispatches back into all four (`GraphDetailPage.tsx:2106`, `:2198`) | `?main=<pageId>` is the one owner. The four flags become *readers* of it, then go |
| `rightSection` | ~~`?ai=1` opens the Assistant; a separate local `inspectorClosed` opens the Inspector~~ | ✅ `?right=assistant \| inspector`, absent means closed. `inspectorClosed` is gone |

This is why the rename is worth doing rather than being a spelling exercise: `mainSection` still has
four owners and does not survive a reload. `rightSection` had two and now has one — naming the
region forced the question of who owns it, and the answer deleted a component.

Do these one region per commit, each with its `e2e/routing.spec.ts` case. `?right=` went first,
ahead of §7.3's symbol renames, because deleting `AssistantDrawerShell` was what made the region
legible. `?main=` has no old URL to alias — there is no `?page=` bookmark in the wild.

`SettingsPanel`, `ListPanel`, `TabbedPanel`, `InspectorPanel`, `ModelPanel` and the rest **keep
their names** — they are occupants, and `<Occupant>Panel` is the rule. The one that changes is
`SessionsPanel` → **`AssistantPanel`**: by that same rule it was named after its *contents* rather
than after the occupant, and the occupant is the Assistant. What is inside stays sessions.

`useSettingsPanel`'s one-way alias machinery already exists for `?settings=`; `useRightSection`
applies the same shape to `?ai=` and `?inspector=open`, and `?panel=` joins the list when `?left=`
lands. Nothing that reads an old URL breaks, and nothing writes one.

### 7.4 `engine/` — nothing to rename, one rule to hold

The engine names things, never regions. Two prose fixes and a guard:

| Where | Now | → |
|---|---|---|
| `explorer/routes.py` · `explorer/services.py` · `explorer/schemas.py` | "the Explorer's type panel", "the panel's legend" | "the **Types** panel" — the occupant, not a place |
| `workflows/routes.py` | "the panel's status bar" | "the `footer`" is Studio's business; say "Studio renders this verbatim" |
| `graphs/services.py` · `graphs/deps.py` | `section` / `missing_sections` for `setup_state` | **keep** — a *setup section*, always qualified. Layout regions are the compound word (`leftSection`), never a bare `section`, so the two never collide |

### 7.5 Order, and the guard

| Step | What | Gate |
|---|---|---|
| 1 | design-kit internals + JSDoc (§7.1), release a patch | `pnpm build` in design-kit |
| 2 | canvas-ui prose (§7.2) | comments only |
| 3 | Studio symbols (§7.3) — one region per commit, `leftNav` first (largest) | `pnpm check-types` after each |
| 4 | `?panel=` → `?left=` (§7.3), legacy reads in the same commit | `e2e/routing.spec.ts` |
| 4a | `?main=` and `?right=` (§7.3a) — new state, one region per commit | `e2e/routing.spec.ts`, reload cases |
| 5 | engine prose (§7.4) | `ruff` |
| 6 | Docs sweep — `rail` ×19, "status bar", "main region" across `docs/for-developers/` | grep returns nothing. **"drawer" is done**: the word is gone from prose and code, and `the-assistant-drawer.md` is `the-assistant.md` |

The guard that keeps it: **a grep for the retired words is part of the review**. `rail`, `sidebar`,
`activity bar`, `auxiliary`, `terminal`, `drawer`, `mainContent` and bare `panel`/`section` as a
place should return zero hits outside `the-shell.md`'s own table.
