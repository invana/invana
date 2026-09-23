# Canvas-UI coverage

The authoritative map from every canvas surface in Studio to the `@invana/canvas-ui` component that
owns it. What [design-kit-coverage.md](design-kit-coverage.md) is to the board, this is to the
canvas: **check here before building canvas chrome.**

| | |
|---|---|
| Package | `@invana/canvas-ui` — source at `~/Projects/invana/canvas/packages/canvas-ui` |
| Studio folders | [`features/explorer/`](code-shape.md#41c-the-two-explore-folders-file-by-file) · `features/canvases/` |
| Rule it enforces | CLAUDE.md › *Design rules* — anything bound to canvas state belongs to `@invana/canvas-ui`; a component the kit lacks is built **there**, with a story, not in `studio/` |

## 1. The rule

| # | Decision |
|---|---|
| CU1 | **canvas-ui first, always.** Before writing a canvas panel, toolbar, card, menu or status strip, read this file and `canvas-ui/src/index.ts`. A surface that exists there is used, not reimplemented — even partially, even "just the tree part". |
| CU2 | **A missing piece is built in canvas-ui, not in Studio.** If canvas-ui is close but not right, the change lands in canvas-ui with a story and is consumed here. Studio never holds a second copy so it can diverge. |
| CU3 | **Chrome is never hand-rolled.** A floating card over the canvas is `Panel` + `PanelContent` with a `position`. A `div` with `absolute right-3 top-3 … rounded-lg border shadow-lg` and a hand-built header is a bug, not a style. |
| CU4 | **One-at-a-time side panels are `useSidePanels`.** [canvases.md](../modules/explore/features/boards.md) CV6 — Layers · Styling · History share an anchor — is exactly what the hook expresses. A hand-rolled `overlay` union is a reimplementation of it. |
| CU5 | **Visibility runs through the store's first-class API.** `store.setNodeHidden` / `isNodeHidden` / `hiddenNodes` / `showAllHidden`, available since `@invana/graph` 0.0.12. Studio does not model "hidden" itself, and does not filter the data to fake it. |
| CU6 | **A Studio adapter that outgrows Studio is promoted, not kept.** `typeColor.ts` reads the `@invana/styling` data palette; canvas-ui's own `typeColor` hashes into a hardcoded list. Ours is the better one, so it goes **down** into canvas-ui rather than staying a private Studio copy ([code-shape.md](code-shape.md) — a component belongs in the lowest layer that can own it). |
| CU8 | **A canvas-ui change never alters an existing default.** New options are opt-in; `GraphCanvasApp`'s base config, the bundled behaviours and the shipped palettes stay as they are unless changing one is the actual request. A default flipped in passing changes every canvas in every consumer at once, and the failure surfaces as "rendering broke" in one browser rather than as the config change it was. Same rule for scope: a bug reported while a change is in flight is a separate piece of work, not an invitation to widen it. |
| CU9 | **Available now beats right eventually — but never a half-port.** Studio adopts what a *released* canvas-ui ships (Track A) as soon as the journey allows, and leaves the rest alone. A surface still being built in canvas (Track B) means Studio's existing file stays exactly as it is until the release lands: no wrapper, no partial adoption, no "temporary" second copy. That is why a Track B item is always two commits in two repos — the canvas-side build, then the Studio-side deletion — and why the deletion is not started early. |

## 1a. Two tracks, and the seam between them

Every row in this file is on one of two tracks. Which one it is on is decided by a single question:
**does a *released* canvas-ui already ship it?**

| | Track A — adopt now | Track B — build in canvas first |
|---|---|---|
| Means | The component exists in `@invana/canvas-ui@0.0.14`, the version Studio pins. Studio deletes its copy and consumes it | canvas-ui has no such surface. It is built **there**, with a story, and reaches Studio on the next canvas release |
| Where | §4 — Track A, the order of work | §5 — Track B, what canvas-ui must gain |
| Worth | ~1,036 lines deletable today | ~1,150 more once B1–B9 land |
| Rule while waiting | Studio keeps its existing file **unchanged**. It does not get a wrapper, a partial port, or a "temporary" second copy (CU2) | — |

**The release seam.** `studio/package.json` pins `@invana/canvas-ui@^0.0.14` **from the registry**, not
the workspace. So a component built in `~/Projects/invana/canvas` is invisible to Studio until that
repo cuts a release and Studio bumps. B4 is the live example: `CanvasVersionsViewPanel` is built,
committed and storied, and `CanvasHistoryPanel.tsx` still ships in Studio unchanged until the bump.
Track B work therefore lands in two commits, in two repos, at two different times — the canvas-side
build, then the Studio-side deletion. Never one.

## 2. The map

Audited 2026-09-10 against `@invana/canvas-ui@0.0.14`.

| Studio | Lines | canvas-ui owns it | Verdict |
|---|---|---|---|
| `explorer/LayersPanel.tsx` | 674 | **`LayersViewPanel`** | ❌ **Fork.** 15 identical symbols (`buildItems` · `groupByType` · `RowContent` · `VisibilityToggle` · `focusElement` · `selectElement` · …). Delete outright |
| `explorer/ExplorerCanvas.tsx` › `ExplorerHeaderToolbar` | 284 | **`GraphControlsToolbar`** | ❌ **Fork.** Composes the same six section hooks (`useLayout` · `useViewSection` · `useSelectMode` · `useGrid` · `useStyleEditorSection` · `useHistorySection`). The magnet toggle and the WebGL/WebGPU picker are genuinely ours — they are two `extraItems` |
| `explorer/visibility.ts` | 78 | **`GraphStore` visibility API** | ❌ **Obsolete workaround.** A sticky `hidden` state flag with a hand-rolled edge cascade, written before the engine had one. It is what forced the `LayersPanel` fork |
| `explorer/StylingPanel.tsx` | 190 | `Panel` · `PanelContent` (chrome) | ⚠️ **Chrome hand-rolled.** The per-type colour / label-property / size list is genuinely Invana's; the card around it is not. Also carries a `#9ca3af` literal — a tokens-only violation |
| `canvases/CanvasHistoryPanel.tsx` | 171 | **`CanvasVersionsViewPanel`** | ⏳ **Built, awaiting a release.** B4 has shipped in canvas-ui (`view-panels/canvas-versions`, with a story) and lands here on the next canvas version. It draws the timeline; the rows, the restore and the per-row banner query stay ours — they read the engine's `canvas_states`, which canvas-ui knows nothing about (a row *is* a `CanvasStateSnapshot`; *version* is the word the user reads — [canvases.md](../modules/explore/features/boards.md) CV11) |
| `boards/DataBoardPage.tsx` › the `overlay` union | ~40 | **`useSidePanels`** | ⚠️ **Reimplements CV6.** The hook turns a list of `SidePanelDef`s into the toggles, the open-state and the region body |
| `explorer/InspectorPanel.tsx` | 178 | `DetailCard` · `PropertyDetailView` · `EdgeEndpoints` · `defaultPropertyRenderers` | ⚠️ **Partial.** Property rendering by kind is duplicated. The provenance block and the `missing` badge are ours. Carries `bg-blue-500/20` · `text-purple-400` — tokens-only violations |
| `explorer/canvasTheme.ts` + `ExplorerCanvas` › `ThemeBridge` | 91 | **`CanvasThemeSync`** | ⚠️ **Same job, different route.** Ours reads CSS tokens off the live DOM; canvas-ui's drives the engine's `ThemeBehaviour` from `useThemeOptional`. Verify the engine path recolours everything ours does before swapping |
| `explorer/typeColor.ts` | 74 | `view-panels/schema` › `typeColor` | ⬇️ **Promote ours.** canvas-ui hashes into a hardcoded `TYPE_PALETTE`; ours reads `--color-data-1…8` from `@invana/styling`. CU6 |
| `explorer/ExpandFineTunePanel.tsx` | 418 | — | ✅ **Ours.** Graph-traversal filters, sorts and limits — an engine concern, no canvas-ui analogue |
| `explorer/ExplorerTypesPanel.tsx` | 413 | — | ✅ **Ours.** The legend-and-selection panel. Its eye rows go through `visibility.ts` today and move to the store API with CU5 |
| `explorer/RendererCapabilityBanner.tsx` | 0 | **`RendererCapabilityBanner`** | ✅ **Moved down (B5).** Studio renders canvas-ui's; the probes it calls are memoised in `renderer-pixijs`, because `hasWebGL` creates a WebGL context to answer and the browser evicts the oldest live one past ~16 |
| `canvases/{canvasKinds,captureBanner,useCanvasStates,CanvasFormDialog}` | 384 | — | ✅ **Ours.** The canvas *record* — kinds, thumbnails, contents, CRUD. canvas-ui draws canvases; it does not persist them |

**Deletable today: ~1,036 lines**, plus the two hand-rolled cards.

## 3. Not adopted yet — free surfaces

**Track A, unclaimed.** Exported by the canvas-ui Studio already depends on, used by nothing here —
each is a screen Studio could gain without a single new component. Adopt one when a journey asks for
it, not to tick it off:

| Component | What it gives |
|---|---|
| `CanvasFiltersViewPanel` | the managed list of set-aside elements, with *Show all* — the companion to Layers |
| `FindInCanvasViewPanel` | structured find-in-canvas: field filters, live results, matched-field highlighting, focus-and-select |
| `GraphCanvasApp` | the whole canvas app shell — header, footer, regions — that `ExplorerCanvas` assembles by hand |
| `NodePreviewCard` · `EdgePreviewCard` · `HoverElementPreviewCard` | hover previews |
| `ExportImagePanel` · `ExportStatePanel` · their toolbars | export, already wired to the engine |

## 4. Track A — the order of work

The visibility workaround is the keystone: it is why the Layers fork exists, so it goes first.

| # | Step | Unblocks | Deletes |
|---|---|---|---|
| 1 | `visibility.ts` → `store.setNodeHidden` / `isNodeHidden` / `hiddenNodes`; drop `HIDDEN_STATE_NAME` and its registration in `ExplorerCanvas`; `ExplorerTypesPanel`'s type-row eye loops the store API | 2 | 78 |
| 2 | `LayersPanel` → `LayersViewPanel`, wrapped in `Panel` + `PanelContent` | — | 674 |
| 3 | `ExplorerHeaderToolbar` → `GraphControlsToolbar` with `extraItems` for magnet + backend | — | ~284 |
| 4 | `StylingPanel` chrome → `Panel` + `PanelContent`; kill the two colour literals. `CanvasHistoryPanel` skips this step — it goes straight to `CanvasVersionsViewPanel` on the next canvas release (B4) | — | ~30 |
| 5 | `DataBoardPage`'s `overlay` union → `useSidePanels` | — | ~40 |
| 6 | `InspectorPanel` property rendering → `DetailCard` + `PropertyDetailView`; keep provenance and the `missing` badge | — | ~80 |
| 7 | `ThemeBridge` + `canvasTheme.ts` → `CanvasThemeSync`, once the engine path is verified equivalent | — | ~91 |
| 8 | Promote `typeColor.ts` into canvas-ui, with a story; consume it here | — | 74 |

Steps 1–6 are Studio-only — every component they consume is in the pinned `@invana/canvas-ui@0.0.14`,
so each is one commit in this repo and nothing waits on anyone. Steps 7–8 are Track B in disguise
(B7, B8): they touch `~/Projects/invana/canvas` first and reach Studio on its next release.

## 5. Track B — what canvas-ui must gain

The nine items below are what stands between Studio and a thin canvas layer — **B4 is built, eight
remain**. Each ships in `~/Projects/invana/canvas/packages/canvas-ui`, **with a story**, and reaches
Studio on the next canvas release (see the release seam in §1a). Ordered by what Studio gets back.

### Already there — do not build these

Worth stating, because each has been proposed at least once:

| Wanted | Already is | Where |
|---|---|---|
| Theme sync | `CanvasThemeSync` | `apps/CanvasThemeSync.tsx` — drives the engine's `ThemeBehaviour` from `useThemeOptional`. `GraphCanvasApp` mounts one in its default bundle |
| Canvas settings | `CanvasSettingsEditorPanel` · `CanvasSettingsBrowser` | `editor-panels/canvas-settings/` — introspects the live `layers` / `behaviours` / `layouts` registries and renders `@invana/forms`' `SettingsPanel`. The design-kit piece is already underneath it |
| Layers browser | `LayersViewPanel` | `view-panels/layers/` |
| Page/tab strip | `BoardPagesViewPanel` | `view-panels/canvas-pages/` |
| Header controls | `GraphControlsToolbar` · `…Lite` | `toolbars/` |
| One-open-at-a-time panels | `useSidePanels` | `hooks/` |
| Floating card chrome | `Panel` · `PanelContent` | `components/` |
| Read-only detail rendering | `DetailCard` · `PropertyDetailView` · `NodeDetailView` · `EdgeDetailView` · `EdgeEndpoints` | `components/` · `toolbars/` |

### To build — four view panels

`view-panels/` is canvas-ui's folder for a surface that reads a **live `GraphCanvas`** and drives it,
as opposed to `editor-panels/` (a form over a serialisable spec) or `toolbars/` (bare items for a
header slot). Four of the nine belong there, and they follow the folder's existing shape: a kebab
folder, one `*ViewPanel` component, an `index.ts`.

| # | `view-panels/…` | Reads | Studio gives up |
|---|---|---|---|
| B1 | **`styling/StylingViewPanel`** | `useDerivedSchema` for the types on the canvas; emits a serialisable `{ nodeTypes, edgeTypes }` patch — colour, label property, size/width per type. The host persists it. Every existing style editor is per-*element* or per-*style-object*; none is per-type-on-this-canvas | `StylingPanel.tsx` — 190 → ~30 |
| B2 | **`selection/SelectionViewPanel`** | the `ClickSelectBehaviour` selection, rendered read-only through `DetailCard` + `PropertyDetailView`, with tabs, a `missing` marking for elements no longer in the graph, and named **slots** for host-owned blocks | `InspectorPanel.tsx` — 178 → ~40 |
| B3 | **`graph-types/GraphTypesViewPanel`** | `useDerivedSchema` again — every type as a row: the colour the canvas actually paints, a count, a visibility eye driving `store.setNodeHidden`. The legend and the list are one thing | `ExplorerTypesPanel.tsx` — 413 → ~200 |
| B4 ✅ | **`canvas-versions/CanvasVersionsViewPanel`** — **built**, ships on the next canvas release | nothing live — presentational. Rows grouped by day, newest first; thumbnail, what changed, who, restore. The host supplies the rows and `onRestore`, and mounts its own lazily-loading banner through the `renderThumbnail` slot; the row for `currentVersionId` is marked and not restorable. An optional `onCapture` draws the capture button. canvas-ui draws the timeline, it does not persist versions | `CanvasHistoryPanel.tsx` — 171 → ~50 |

B1 and B3 share `useDerivedSchema`, which is the reason they are two panels and not one: the same
reactive type list, styled in one and hidden in the other.

**On B2's name.** `InspectorPanel` is taken — `toolbars/InspectorPanel` *edits* the click-inspect
target through `PropertiesEditor`. B2 is read-only and driven by the *selection*. Two components
called inspector in one package is a name that stops being true the first time either moves
([code-shape.md](code-shape.md) §4.1a), so the subject names it. *Inspector* stays Invana's word for
the region ([terminology.md](../terminology.md)); `SelectionViewPanel` is what fills it.

### To build — the other five

Not view panels: a `components/` banner, a `toolbars/` section, a `@invana/graph` behaviour,
a helper, and an `editor-panels/` form. B1–B4 are in the table above — they are not repeated here.

| # | Component | Where | Studio gives up |
|---|---|---|---|
| B5 ✅ | `RendererCapabilityBanner` — silent on WebGPU, a dismissible notice on the WebGL fallback, a permanent alert when neither can draw. `capabilities` overrides the probes so every outcome is reachable; one story per outcome | `components/` | `RendererCapabilityBanner.tsx` — 85 → 0 |
| B6 | `renderer` + `neighbours` sections on `GraphControlsToolbar`. Neighbours self-wires through the new `useHoverNeighbours`; the renderer picker is host-owned (`{ value, onChange }`) because switching backends remounts the canvas — `GraphCanvasApp` gained `preference` to make that possible, and `ToolbarSelectItem` gained `disabledOptions` so an unavailable backend states why | `toolbars/` | ~60 of `ExplorerHeaderToolbar` |
| B7 | `ThemeBehaviour` reads the themed document itself (`data-theme` carries family + kind), replacing `CanvasThemeSync`. **Gated on CU8**: it must not change the bundled default | `@invana/graph` | `canvasTheme.ts` + `ThemeBridge` — 91 → 0 |
| B8 | `typeColor` to read `--color-data-1…8`, cached per document and cleared by `CanvasThemeSync` on a theme flip; the old hard-coded hues remain as the no-tokens fallback. CU6: ours moved **down**, it was not deleted | `view-panels/schema/` | `typeColor.ts` — 74 → 0 |
| B9 | `GraphExpandEditorPanel` — direction · relationship · neighbour type · filter rows · sort · limit against a supplied `GraphExpandSchema`, emitting a `GraphExpandSpec`. `expandToForm` / `formToExpand` are the mapping; `offset` rides through so editing the narrowing does not reset the host's page | `editor-panels/graph-expand/` | `ExpandFineTunePanel.tsx` — 418 → ~150 |

### What Studio keeps, and why

| Stays in Studio | Because |
|---|---|
| `canvasKinds.ts` · `captureBanner.ts` · `useCanvasStates.ts` · `CanvasFormDialog.tsx` | the canvas **record** — kinds, thumbnails, contents, CRUD. canvas-ui draws canvases; it does not persist them |
| The provenance block, the dataset link, graph-wide type counts | engine facts, reached through Invana's API |
| `usePages.ts` · `useCanvasTabs.ts` · `CanvasPages.tsx` | which page is open is Studio's URL state; the strip that draws it is canvas-ui's |

### The arithmetic

| | Lines |
|---|---|
| Deletable with what canvas-ui ships **today** (§4) | ~1,036 |
| Deletable once B1–B9 land | ~1,150 more |
| `features/explorer/` + `features/canvases/` today | ~3,100 |
| After both passes | **~900** |

### Order

**B4 is built** (`view-panels/canvas-versions`, with a story); Studio consumes it on the next
canvas release, since it pins `@invana/canvas-ui@^0.0.14` from the registry rather than the
workspace. Nothing else below is built. An attempt at B5–B9 was reverted: it changed
`GraphCanvasApp`'s default theme config for every consumer and grew unrequested
context-loss handling across three packages. The lesson is in CU8.

Nothing here blocks §4. Steps 1–6 of that list run against the canvas-ui that exists now.


## 6. Not building

| Not building | Because |
|---|---|
| A Studio wrapper around every canvas-ui panel "for consistency" | the wrapper is where the fork starts; consume the component directly |
| A canvas-ui fork in `studio/ui/` | `studio/ui/` is only for what the kit *cannot* own (DS2) — a canvas panel is never that |
| Keeping both a Studio and a canvas-ui Layers while "we migrate" | two copies of a tree that drive the same store is exactly the state this document exists to end |
