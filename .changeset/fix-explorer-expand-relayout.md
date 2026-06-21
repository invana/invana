---
"studio": patch
---

Upgrade canvas packages to 0.0.7 and keep node-expand from re-laying out the whole graph.

Bumped `@invana/canvas`, `@invana/canvas-react`, `@invana/graph`, `@invana/graph-layout-d3-force` and `@invana/graph-layout-elkjs` to 0.0.7.

0.0.7 exposes the renderer-capability helpers (`canUseWebGPU`, `hasWebGL`, `isWebKit`, …) from `@invana/canvas`, re-exported via `@invana/canvas-react`. Studio's local `useWebGPUAvailable.ts` (duplicated copies of those pure functions plus an async `requestAdapter()` probe) was removed entirely: the backend default and WebGPU-toggle gating now use the synchronous `canUseWebGPU()`, and the capability banner uses `canUseWebGPU()` / `hasWebGL()`. The async probe and the per-page WebGPU→WebGL fallback effects were redundant — the engine itself downgrades to WebGL at init when a selected WebGPU adapter can't initialise.

Expanding a node in the Explorer (RFC-035) used to re-feed the entire dataset through `<GraphLayer data>`, which calls the destructive `setData` — wiping every node's position and re-laying the graph out from the origin on each expand, so the whole canvas jumped around. Expansion now appends only the new neighbours straight to the live store (`store.addData`) and runs an incremental d3-force pass seeded from current positions, so existing nodes stay put.

New neighbours are also given an initial position on a ring around the existing node they were expanded from, instead of the store's default world origin `(0,0)`. Without this they all spawned on the same empty origin spot — far from the already-laid-out graph — and a single seeded force pass couldn't drag them across to their parent before it settled, leaving them piled on one point. Birthing them next to their anchor lets the force pass simply fan them out locally; the ring's radius scales with the neighbour count so a high-degree hub starts pre-separated rather than as a tight overlapping cluster.

The active force layout is also retuned for readability and feel. It now animates (`animate: true`) so the graph visibly settles on each query and expand, and cools quickly (`alphaDecay` / `alphaMin`, `velocityDecay`) so it settles in ~90 ticks instead of d3's ~300 rather than drifting for seconds. Spacing is balanced for hub-and-spoke shapes that are themselves linked into a larger graph: `charge.distanceMax` caps the node repulsion to a local radius so a hub's leaves spread apart without whole clusters shoving each other into opposite corners, while a short `link.distance` and a `collide.radius` above the node-plus-label size keep clusters close and overlap-free.

Finally, the active layout now freezes the instant the pointer presses on a node or edge (`*:pointerdown`, which fires before `contextmenu`). Without this, a node could drift out from under the cursor mid-animation, so the right-click hit-test missed and the node context menu (Load neighbors, …) never opened. The next query / expand re-runs the layout, so this only ends the current settle.
