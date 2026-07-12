# Canvas per-element visibility (hide/show) — API request + studio cleanup

**Status:** pending upstream (`@invana/canvas` / `@invana/graph`)
**Owner:** canvas library
**Blocks cleanup of:** Explorer Layers panel workaround (`studio/`)
**Created:** 2026-07-11

## Why this exists

The Explorer **Layers panel** (`studio/src/pages/graphs/explorer/components/LayersPanel.tsx`)
lets a user hide/show individual nodes and edges from its file-tree. But
`@invana/canvas` (v0.0.11) has **no per-element visibility API** — the only
visibility primitive is whole-layer (`ILayer.visible`). The canonical element
states (`hovered · selected · highlighted · dimmed · disabled`) don't include a
"hidden" one, and none of them removes an element from render/hit-test/bounds.

So the studio currently fakes it: it registers a sticky `hidden` **style-state
overlay** (alpha 0) on the graph layer and toggles it per element via
`store.setNodeState(id, "hidden", …)`. This works visually but is a workaround
with real gaps:

- Hidden elements are still **hit-testable** (alpha 0, not culled) — you can
  click a node you can't see.
- Hidden elements still count toward **bounds / `fitContent` / focus** and
  **layout**, so "fit to content" and force layout include invisible nodes.
- The **incident-edge cascade** (hiding a node must hide its dangling edges, and
  showing it must only restore edges whose other endpoint is visible) is
  **hand-rolled in the studio** (`setNodeHidden` in `LayersPanel.tsx`) instead of
  owned by the engine.
- No visibility **events**, so the panel can't cheaply react to external changes.
- Hidden state isn't **serialized**, so a saved canvas doesn't restore it.

When the canvas library ships a real API (below), delete the workaround and use
it. See **Studio cleanup checklist**.

## What the canvas library needs to implement

First-class hidden/visible for nodes and edges — single + bulk (batched) — honored
by the renderer, hit-test, bounds/camera, layout, labels/LOD, and minimap; plus
events and serialization. Keep whole-layer visibility but round it out.

### 1. Data model (`GraphStore`)
- `GraphNode.hidden?: boolean`, `GraphEdge.hidden?: boolean` — a first-class flag
  (sibling of `pinned`), tracked in an index, accepted on `addNode`/`addEdge`/
  `updateNode`/`updateEdge`.
- **Effective visibility** (owned by the store, not consumers):
  - node effectively hidden ⇔ explicitly hidden;
  - edge effectively hidden ⇔ explicitly hidden **or** either endpoint hidden;
  - showing a node restores an incident edge **only if** that edge is not
    explicitly hidden **and** its other endpoint is visible.

### 2. Store API (source of truth, batched)
```ts
// single (composes inside a caller's store.batch())
hideNode(id): void;  showNode(id): void;  setNodeHidden(id, hidden): void;
toggleNodeHidden(id): boolean;  isNodeHidden(id): boolean;  isNodeVisible(id): boolean;
// bulk — wrap in one store.batch() → one flush → one paint
hideNodes(ids): void;  showNodes(ids): void;  setNodesHidden(ids, hidden): void;
// iteration / counts
hiddenNodes(): IterableIterator<string>;  hiddenNodeCount(): number;
```
Mirror the full set for edges (`hideEdge/showEdge/setEdgeHidden/toggleEdgeHidden/
isEdgeHidden/isEdgeVisible/hideEdges/showEdges/setEdgesHidden/hiddenEdges/
hiddenEdgeCount`). Plus `showAllHidden(): void`.

### 3. `GraphLayer` convenience
Same hide/show/toggle/isHidden methods on `GraphLayer` (delegating to `store`),
with the incident-edge cascade applied — so callers that already hold the layer
(they call `focusNode`/`focusNodes`/`focusEdges`) don't reach into `store`.

### 4. Rendering & interaction (the whole point)
Effectively-hidden elements are excluded from:
- **render** — culled from the batch entirely (not alpha 0): no body/label/badge,
  no edge line/arrow/label;
- **hit-test** — `WorldLayer.hitTest` / spatial index skips them;
- **bounds & camera** — `getBounds`/`boundsOfNode`/`camera.fitContent`/
  `focusNodes`/`focusEdges` ignore hidden (opt-in `{ includeHidden?: boolean }`);
- **layout** — excluded from force sims + one-shot layouts (configurable
  `includeHidden?`, default false); hidden positions frozen;
- **labels/LOD** and **minimap** — honor hidden;
- **selection/clipboard** — hiding deselects; `selectAll`/brush/lasso skip hidden.

### 5. Events
Extend `GraphStoreEventMap` + the `DataSource` flush/`LayerFlush` delta; bump
`store.version`:
- `node:visibility` `{ id, hidden }`, `edge:visibility` `{ id, hidden }`
  (bulk ops coalesce per flush like add/remove).

### 6. Whole-layer visibility (round it out)
- `Layer.setVisible(visible): void` that repaints and emits
  `layer:visibilitychange` `{ id, visible }` on the `LayerRegistry` bus (today you
  set `.visible` then must call `.redraw()` manually, and nothing is emitted).
- Dependent layers (minimap) + render loop react automatically.

### 7. Serialization
`exportCanvasState` / `serializeDefinition` / import round-trip the hidden node +
edge sets and per-layer `visible`.

### 8. Back-compat + tests + docs
- Don't break `setNodeState`/canonical states; deprecate the fake-`hidden`-state
  pattern in docs.
- Tests: single + bulk hide/show; cascade (hide node hides incident edges;
  showing one endpoint keeps a shared edge hidden while the other endpoint is
  hidden; explicitly-hidden edge stays hidden when endpoints show); hit-test
  excludes hidden; bounds/`fitContent` excludes hidden; bulk = one flush;
  serialization round-trips.
- Changeset per repo convention.

## Studio cleanup checklist (do this when bumping `@invana/canvas`)

Once the API above is in the installed canvas version:

1. **`studio/src/pages/graphs/explorer/components/ExplorerCanvas.tsx`**
   - Delete `HIDDEN_STATE_NAME`, `HIDDEN_NODE_STATE`, `HIDDEN_EDGE_STATE`.
   - Revert the `<GraphLayer>` props back to `node={{ style: nodeStyle }}` /
     `edge={{ style: edgeStyle }}` (drop the `state:` overlays).
2. **`studio/src/pages/graphs/explorer/components/LayersPanel.tsx`**
   - Delete the hand-rolled `setNodeHidden(store, id, hidden)` cascade helper.
   - Replace the hide/show menu action with `layer.hideNode/showNode` (or
     `hideEdge/showEdge`), letting the engine own the cascade.
   - Replace `store.hasNodeState(id, HIDDEN_STATE_NAME)` /
     `hasEdgeState(...)` (the struck-through indicator) with `isNodeHidden` /
     `isEdgeHidden`, and drop the `HIDDEN_STATE_NAME` import.
   - Subscribe to `node:visibility` / `edge:visibility` so the struck-through
     indicator updates when visibility changes elsewhere.
3. **New capability to add** (was skipped for lack of batched bulk-hide):
   - **Hide all / Show all** on the type-group context menu (e.g. hide every
     `Person`) via `hideNodes(ids)` / `hideEdges(ids)` (batched).
   - Optionally wire the hidden-element hit-test fix removes the "invisible but
     clickable" caveat automatically.
4. Remove the "hidden elements remain hit-testable" caveat from the changeset /
   any user docs.

## Paste-ready prompt for the canvas repo

> Add first-class per-element visibility (hide/show) to `@invana/graph` /
> `@invana/canvas`. `GraphStore` gains `GraphNode.hidden` / `GraphEdge.hidden`
> first-class flags with explicit-hidden indexes, and effective-visibility rules
> owned by the store (an edge is effectively hidden if explicitly hidden or either
> endpoint is hidden; showing a node restores an incident edge only if it isn't
> explicitly hidden and its other endpoint is visible). Add store methods
> `hideNode/showNode/setNodeHidden/toggleNodeHidden/isNodeHidden/isNodeVisible/
> hiddenNodes/hiddenNodeCount` + batched bulk `hideNodes/showNodes/setNodesHidden`
> + `showAllHidden`, and the full mirror for edges; expose the same on `GraphLayer`
> (delegating, with incident-edge cascade). Effectively-hidden elements must be
> culled from render (not alpha 0), skipped by hit-test, excluded from
> `getBounds`/`boundsOfNode`/`camera.fitContent`/`focusNodes`/`focusEdges` (opt-in
> `includeHidden`), excluded from layout (configurable, frozen positions), and
> honored by labels/LOD, minimap, and selection. Emit `node:visibility` /
> `edge:visibility` on `GraphStore.events` + the flush delta, bump `store.version`.
> Add `Layer.setVisible()` emitting `layer:visibilitychange` (auto-redraw).
> Round-trip hidden sets + layer `visible` through `exportCanvasState` /
> `serializeDefinition` / import. Keep `setNodeState`/canonical states working
> (deprecate the fake-`hidden`-state pattern). Add tests + a changeset.
