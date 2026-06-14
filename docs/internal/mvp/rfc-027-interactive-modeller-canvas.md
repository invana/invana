# RFC-027: Interactive Modeller canvas (tool-driven schema authoring)

**Status**: Proposed
**Author**: Invana Team
**Date**: 2026-06-14
**Related**:
- **RFC-021** (Model-first authoring) — its Scope listed *"Interactive canvas editing (draw types on the
  `SchemaCanvas`)"* as an explicit **follow-up / non-goal**. This RFC re-scopes that exclusion as now
  in-scope and supersedes that line.
- **RFC-019** (Multiple GraphModels per Graph) — the `GraphModel` / `GraphVersion` / node-edge-property
  type tree the canvas edits.
- **RFC-022** (Property-type capabilities) — rich property authoring (data types, mappings) stays in the
  side-panel forms; the canvas does not duplicate it.

---

## Problem / intent

The Modeller's `SchemaCanvas` was a **read-only** diagram: it rendered a draft's node/edge types via
`@invana/canvas-react` but offered no authoring — every edit went through the left `SchemaNav` "+"
buttons, the form dialogs, and the right `DetailPanel`. `SchemaCanvas` even received `selected` /
`onSelect` props it ignored. RFC-021 deferred interactive editing because the canvas library lacked the
modelling primitives.

`@invana/canvas-react` v0.0.6 now ships the modelling toolkit (`GraphToolProvider` / `useTool`,
`ModellerToolbar`, and the tool-gated `CreateNodeBehaviour` / `DrawEdgeBehaviour` / `EraseBehaviour` /
`ClickInspectBehaviour` + `PropertiesEditor`), demonstrated by the canvas repo's `GraphModellerApp`
story. This RFC wires those into the Modeller so the canvas becomes the primary authoring surface for a
draft — without expanding the backend.

## Decisions (locked)

1. **Create via the existing dialogs.** The **Add** tool (click empty canvas) opens the existing
   `NodeTypeFormDialog`; the **Connect** tool (drag node→node) opens `EdgeTypeFormDialog` **prefilled**
   with the dragged endpoints' node-type names. The drawing behaviours do **not** commit to the canvas
   store — `createNode` / `createEdge` return `null` (a documented veto) after requesting the dialog; the
   dialog's existing create mutation → query invalidation → refetch re-renders the data-driven canvas.
2. **Ephemeral positions.** Node positions come from a D3 force layout on each load; nothing is persisted
   (the backend has no x/y columns and we add none). Persisted layout is a future item.
3. **Selection drives the right-side `DetailPanel` — no on-canvas inspector.** The **Select** tool's
   click arms a `ClickInspectBehaviour` whose target is mapped to a `SelectedItem` and lifted to
   `ModellerPage`, so clicking a node/edge opens it in the right-side `DetailPanel`, where all editing
   lives (rename via the type's **Edit** form, inline property add/edit, reverse via the edge context
   menu). **Superseded:** an earlier revision floated a small on-canvas `PropertiesEditor`
   (`NameInspector`) for inline rename; it was removed as redundant with the `DetailPanel` (which already
   shows the same type's label + properties). The `DetailPanel` is the single editing surface; the canvas
   only selects + draws.
4. **Delete via the existing mutations.** The **Delete** tool's `EraseBehaviour` deletes a type directly
   (no confirm — it has already removed the element from the canvas store; the refetch is authoritative).
   The right-click context menus offer a confirmed delete (reusing the existing `AlertDialog`).
5. **Draft gating.** Authoring tools (toolbar, Add/Connect/Delete behaviours, inspector, context menus)
   render only when an editable-draft `ModelEditCtx` exists. Read-only models (published + system
   `introspected`/`global`) get the **read-only exploration canvas** described in Decision #6 instead —
   clicking still drives the `DetailPanel`.
6. **Read-only models are full Explorer-grade explorers (minus magnet + mutation).** The `SchemaCanvas`
   splits on `ctx`: an editable draft renders the tool-driven `AuthoringSchemaCanvas`; a read-only model
   renders a new `ExploreSchemaCanvas` that mirrors the **Explorer's** read-capable canvas. It mounts the
   same `@invana/canvas-react` behaviours — pan / drag-node / wheel / **pinch** zoom, click-select
   (`multiple`) + **brush** + **lasso** select modes, **label LOD**, **colour-by-type**
   (`ColorByLabelBehaviour` keyed on the node-type name), a **minimap**, parallel-edge fan-out, and the
   three right-click menus (node: focus / select / select-neighbourhood / highlight-neighbours / show
   details; edge: focus / select / highlight / show details; background: select-mode submenu / fit /
   select-all / clear-selection / clear-highlights). The header reuses the **Explorer's** full toolbar
   (`ExplorerHeaderToolbar`) — layout switcher, run-layout, re-render, edge-routing style, zoom / fit /
   lock, grid, and the WebGL/WebGPU render-backend switcher. Two Explorer affordances are **excluded**:
   the **magnet** (hover-highlight-neighbours) — the user asked for it off — and **clipboard / mutation**
   items (cut / copy / paste / delete) and **undo/redo**, which are meaningless on a non-editable model.
   `ExplorerHeaderToolbar` gained additive `showMagnet` / `showHistory` flags (default `true`; the
   Modeller passes `false`) so it is reused rather than reimplemented; the explore canvas keeps the
   Explorer's behaviour ids (`pan` / `drag-node` / `brush-select` / `lasso-select` / …) so the toolbar's
   view-section lock and select-mode submenu drive it unchanged. Backend choice persists under
   `modeller.canvas.backend` (separate from the Explorer's key).

## Implementation

Layout mirrors the **Explorer's in-shell pattern** (the `GraphVisualiserApp` counterpart, already shipped
in this repo): the toolbar lives in the `GraphDetail` **header**, and the footer carries a status bar + a
per-tool hint — rather than floating panels over the canvas. This is the adaptation of the reference
`GraphModellerApp` story (which uses `@invana/themes`' `AppLayoutBase` header/footer) onto our `GraphDetail`.

- **`ModellerPage.tsx`** — lifts `GraphToolProvider` (active tool, shared with the in-canvas behaviours)
  and `CanvasContext.Provider` (the live engine, fed by `SchemaCanvas`'s `CanvasBridge`) **above
  `GraphDetail`**, because the header toolbar + footer bars are siblings of `<Canvas>`, outside its own
  provider. It renders the `ModellerHeaderToolbar` in `headerCenter` (whenever a model is open),
  `GraphStatusBar` in `statusMetrics`, and `CanvasMessageBar` in `footerRightExtras` (the latter two gated
  on the live engine).
- **`ModellerHeaderToolbar`** (in `SchemaCanvas.tsx`) — the Select/Add/Connect/Delete switcher. It depends
  **only** on the lifted `GraphToolProvider` (via `useTool`), **not** on the canvas engine — so it renders
  the instant a model opens, independent of when `<Canvas>` publishes its engine. (The turnkey
  `ModellerToolbar` can't be used here: its internal `useClipboard`/`useClearGraph`/`useHistory` hooks call
  `useResolvedCanvas`, which throws until the engine is live.) Authoring tools are enabled on an editable
  draft and disabled with a "create a draft to edit" tooltip on read-only versions.
  It also passes `ctx` + gesture callbacks (`onReady`, `onRequestAddNode`, `onRequestAddEdge`,
  `onRequestDelete`, `onEraseType`, `onUpdateName`, `onReverseEdge`) wired to the existing dialog state +
  create/update/delete mutations; `edgeForm` gained an optional `prefill`.
- **`SchemaCanvas.tsx`** is a **selector**: it builds the canvas `GraphData` once (shared `buildSchemaData`),
  then renders `AuthoringSchemaCanvas` when an editable-draft `ctx` is present, else `ExploreSchemaCanvas`
  (the read-only explorer of Decision #6). The empty read-only case still shows the "run Introspect" hint.
- **`ExploreSchemaCanvas`** — `Canvas` (config-first `EXPLORE_OPTIONS`: `activeLayout` + enabled
  behaviours, **no hover/magnet**) → grid `BackgroundLayer` → `GraphLayer` → `ColorByLabelBehaviour` →
  registered `D3ForceLayout` + an `ExploreAutoLayout` that runs it on data change → `ThemeBridge` →
  pan/drag/wheel/pinch + click-select/brush/lasso + `ClickInspectBehaviour` (→ `ExploreInspectBridge`
  maps the inspect target back to a `SelectedItem` for the `DetailPanel`) + label-LOD + parallel-edge +
  `MiniMapLayer` → `ExploreContextMenus` (read-only nav menus via `useSelectMode`) → `CanvasBridge`.
  Keyed on `backend` so the render-backend switch remounts it.
- **`AuthoringSchemaCanvas.tsx`** (rewritten) — `Canvas` (config-first `MODELLER_OPTIONS`: grid `BackgroundLayer` +
  `GraphLayer` + always-on pan/wheel) → `ThemeBridge` (follows Studio's light/dark via
  `useGraphCanvasUpdate`) → legacy `D3ForceLayout` (remounted on data-reference change to re-seed
  positions) → an inner `ModellerTools` (inside `<Canvas>`, so it can call `useTool` / `useGraphCanvas` /
  `useInspectTarget`) holding the tool-gated `DragNode`/`ClickSelect`/`ClickInspect`/`CreateNode`/
  `DrawEdge`/`EraseBehaviour`, the `ParallelEdgeBehaviour`, a per-tool `canvas.showMessage` hint, the
  `NameInspector` (`PropertiesEditor` in a `<Panel>`), and the three `Graph*ContextMenu`s → a final
  `CanvasBridge` that publishes the engine to the lifted context. A `useMemo` adapter produces canvas
  `GraphData` (node ids = node-type **names**; edge ids = `${edgeTypeId}:${src}->${tgt}`) plus name↔id maps
  that bridge canvas clicks to `SelectedItem` and back to the mutations.
- **Node/edge styling lives on the `GraphLayer` `node`/`edge` props** (the layer's creation options), not
  on canvas `config`. `Canvas.update(config)` applies layer styling via `this.layers.get(id)?.setOptions(…)`
  — optional-chained, so it **silently drops** when the layer isn't yet registered at config-apply time (a
  mount race). Passing the style as creation options puts the circle shape on the template from the moment
  the layer mounts; `<ThemeBridge>` then merge-patches only the theme-varying colours (label-on-background,
  edge stroke) via `update()`, which runs after the layer exists. Per-node/edge data carries **no** `style`
  (a per-instance style replaces the template, leaving a label with no shape) — labels resolve at the
  template level (`labelText: (n) => n.id`).
- **`EdgeTypeFormDialog.tsx`** — accepts an optional `prefill` and seeds the source/target checklists
  when creating (its checklists already key on node-type names, matching the name-based edge endpoints).
- The dead read-only `components/canvas/GraphCanvas.tsx` wrapper is **removed** (superseded; nothing
  imported it after the rewrite).

**Undo/redo is intentionally omitted** (no `GraphHistoryProvider`, `showHistory={false}`). The canvas is
server-driven — every structural edit is a backend mutation followed by a query refetch that replaces the
canvas store — so a client-side history stack would reference stale nodes and be wiped on the next refetch.
This is the one place we diverge from the reference story (which journals free-form store edits).

## Canvas dependency surface

Studio renders graphs exclusively through **`@invana/canvas-react`** and never imports `@invana/canvas`
directly (satisfying CLAUDE.md #10 — "Studio uses canvas for all graph rendering" — at the React-bindings
layer). `@invana/canvas`, `@invana/graph`, and `@invana/graph-layout-d3-force` remain in
`studio/package.json` because they are **peer dependencies** of `@invana/canvas-react`; removing them
would leave unmet peers. Type-only imports from `@invana/graph` (e.g. `GraphData`, `InspectTarget`) are
allowed — that's the data contract, not the engine.

## Non-goals (unchanged from RFC-021 / mvp.md)

- Persisted canvas layout positions (would need backend x/y columns + a migration — a separate RFC).
- Constraints & Indexes authoring UI.
- YAML round-trip of hand-authored models.
- Rich property editing on the canvas (stays in the `DetailPanel`).

## Verification

On a **draft** model in Studio: **Add** → click empty canvas → `NodeTypeFormDialog` opens (no canvas node
committed yet) → submit → node appears after refetch. **Connect** → drag node→node → `EdgeTypeFormDialog`
opens with source/target prechecked → submit → edge appears. **Select** → click a node → inline rename →
Apply → label updates; click an edge → Reverse → endpoints swap; rich property editing still in the
`DetailPanel`. **Delete** tool / context-menu delete → type disappears and stays gone after refetch.
Open the system `global` (introspected) model or a published version → the **read-only explorer**: no
Select/Add/Connect/Delete switcher; instead the Explorer toolbar (layout / run / re-render / zoom / fit /
lock / grid / render-backend, **no magnet, no undo/redo**). Drag nodes, pinch/wheel zoom, switch select
modes (click/brush/lasso via the background menu), see the minimap + per-type colours; right-click a node
→ Focus / Select / Select neighbourhood / Highlight neighbours / Show details; right-click an edge →
Focus / Select / Highlight / Show details; clicking a type opens it in the `DetailPanel`. No item mutates
the model. `grep -rn '@invana/canvas"' studio/src` → zero (only `@invana/canvas-react`); `pnpm check-types`
+ `pnpm lint` clean.
