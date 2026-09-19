---
"studio": patch
---

Upgrade the `@invana/canvas` family to `0.0.12` and clear the type errors that had
accumulated behind a check that was compiling nothing.

**The canvas bump.** `@invana/canvas`, `canvas-react`, `graph`, `graph-layout-d3-force`
and `graph-layout-elkjs` move to `0.0.12`, and `@invana/canvas-ui` joins them. Three
things moved with it:

- **The React components left `canvas-react` for `canvas-ui`** — `CanvasMessageBar`,
  `GraphStatusBar`, the three context menus and their menu-context types,
  `ToolbarItem(s)` and `applyIconOverrides`. `canvas-react` keeps the hooks,
  behaviours, layers and layout bindings.
- **`<Canvas>` no longer provides `GraphCanvasContext`** — only `<GraphCanvas>` does,
  and it provides both contexts. Props are identical
  (`GraphCanvasProps = CanvasRootProps`), so it is a one-word change, but a child
  calling `useGraphCanvas()` under a plain `<Canvas>` now throws *at render* with
  nothing at the type level to warn you. All three Studio canvases — Explorer,
  Schema and Work — were doing exactly that, and all three now root on
  `<GraphCanvas>`.
- Renames and a tightening: `LabelResolutionLODBehaviour` → `TextResolutionLODBehaviour`,
  `ColorByLabelBehaviour` → `ColorByBehaviour`, and `GraphEdge` now requires a `type`.

`canvas-react@0.0.12` also **statically imports** `@invana/renderer-pixijs`,
`graph-layer-d3-contour`, `graph-layer-maplibre` and `graph-layout-d3-sankey`. Four of
them are declared *optional* peers, which a top-level import makes untrue — without
them Vite cannot pre-bundle `canvas-react` at all. All four are now direct
dependencies; Rollup tree-shakes the unused ones, so they cost `node_modules` and not
bytes. `pixi.js` moves to `^8.20.1` to satisfy `canvas-react`'s peer range.

**The build.** `pnpm check-types` ran bare `tsc --noEmit` against a root config of
`{"files": [], "references": [...]}`, which TypeScript honours literally — it compiled
**zero files** and had always passed. It is now `tsc -b --noEmit`, and the 26 errors
it had been hiding are fixed:

- 16 of them were one wrong type annotation, written twice: `NodeStyle` / `EdgeStyle`
  where the fields are function resolvers, which is `ResolvableNodeStyle<GraphNode>` /
  `ResolvableEdgeStyle<GraphEdge>`.
- `Turn.clarifications` in `SessionTasksView` was annotated singular while its producer
  and consumer are both plural — the only genuine defect in the set.
- `ExplorerPage`'s `Record<string, unknown>` → `CanvasStateSnapshot` cast is now an
  `isCanvasStateSnapshot` guard, so a state written by an older engine is refused with a
  toast instead of throwing inside the renderer.
- `thinking.store` wrote defaults *before* the spreads meant to layer over them; they
  are now a `freshView()` factory spread first — a factory, not a constant, so one
  shared `steps: []` cannot leak between thinkings.
- `GraphStore.getNodes` → `nodes()`, `ILayer.getBounds` → an `instanceof WorldLayer`
  narrow, `useAuth().accessToken` → the auth store, and a `readonly string[]` prop.

Two casts remain, at `GraphForm` and `GraphCreatePage`: react-hook-form's `Control` is
invariant in its field-values parameter, so `Control<FormShape>` will not assign to
`ObjectFieldProps`' `Control<any>`. The fix belongs in `@invana/forms` — make
`ObjectField` generic in `TFieldValues` — and each call site says so.

**The sweep.** 2,360 lines that nothing imported are deleted (`ModellerPage`,
`CanvasesPanel`, `SchemaOverview`, `SchemaNav`, `ModelListPanel`,
`SchemaCanvasPlaceholder`, `GraphStatusBadge`, `ui.store`). `rbush`, `d3-force`,
`immer` and `@types/d3-force` had zero imports and are dropped. Form *types* now come
from `@invana/forms`, which re-exports them, leaving `react-hook-form` in three files
for `useForm` alone. A `@/` → `src/` alias is registered in both Vite and tsconfig, so
cross-module imports can stop being positional.
