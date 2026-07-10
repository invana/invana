---
"studio": minor
---

Explorer canvas Layers panel — a new left-rail section (Layers icon) that lists
every layer registered on the live canvas as a file-tree.

The rail's `?settings=layers` key docks a `LayersPanel` alongside Sessions and
the Model browser. It reads the live `GraphCanvas` and renders each layer
(background / graph / minimap …) top-first via the design-kit `TreeView`. The
Graph layer expands into its painted contents grouped by node/edge type with
live counts; each type in turn expands into its individual nodes/edges — nodes
labelled by a name-ish property (falling back to the id), edges as
`source → target`. Each layer row carries a Photoshop-style visibility eye on the
right that shows/hides that layer on the canvas without touching its data.

Right-click any layer or element row for a context menu: **Focus** (select +
centre the camera on it), **Select** (highlight it on the canvas), and
**Hide/Show**. Per-element hide is non-destructive — it toggles a sticky `hidden`
style overlay registered on the graph layer (alpha 0), so the element stays in
the store and its count is unchanged; hidden elements are struck through in the
tree. Hiding a node also hides its incident edges so nothing dangles, and they
reappear when both endpoints are visible again. Left-clicking an element row
selects it.

Built to hold up on large canvases (100k+ nodes / 500k+ edges): each type lists
15 elements with an on-demand "Show more", the grouping keeps only the shown
sample in memory (never materialising the full set) while still tallying exact
counts, store-mutation churn is coalesced to one rebuild per animation frame
(a bulk load emits one event per element), and the tree is memoised so unrelated
re-renders don't re-scan the store.
