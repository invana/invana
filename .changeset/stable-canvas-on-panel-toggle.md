---
"studio": patch
---

Fix the Explorer/Modeller canvas re-laying-out its graph every time a left panel (Sessions, Model, Canvases, or a settings section) is opened or closed.

`AppLayoutV2` renders its main content through a `leftSection ? <Group>…</Group> : <div>…</div>` ternary, so toggling the left panel swapped the element type at the canvas's parent position — React unmounted and remounted the canvas, which rebuilt the `@invana/canvas` store from the seed and re-ran layout from origin, throwing away every node position. `GraphDetail` now builds the split on `AppLayoutV1` with the main (canvas) panel always mounted at a stable position and the sidebar as a conditional sibling before it (the same pattern the inspector panel already used), so the canvas — and its live positions — survive a panel toggle. The ExplorerPage reseed that papered over the remount is removed.
