---
"studio": patch
---

Upgrade canvas packages to 0.0.7 and keep node-expand from re-laying out the whole graph.

Bumped `@invana/canvas`, `@invana/canvas-react`, `@invana/graph`, `@invana/graph-layout-d3-force` and `@invana/graph-layout-elkjs` to 0.0.7.

0.0.7 exposes the renderer-capability helpers (`canUseWebGPU`, `hasWebGL`, `isWebKit`, …) from `@invana/canvas`, re-exported via `@invana/canvas-react`. Studio's local `useWebGPUAvailable.ts` (duplicated copies of those pure functions plus an async `requestAdapter()` probe) was removed entirely: the backend default and WebGPU-toggle gating now use the synchronous `canUseWebGPU()`, and the capability banner uses `canUseWebGPU()` / `hasWebGL()`. The async probe and the per-page WebGPU→WebGL fallback effects were redundant — the engine itself downgrades to WebGL at init when a selected WebGPU adapter can't initialise.

Expanding a node in the Explorer (RFC-035) used to re-feed the entire dataset through `<GraphLayer data>`, which calls the destructive `setData` — wiping every node's position and re-laying the graph out from the origin on each expand, so the whole canvas jumped around. Expansion now appends only the new neighbours straight to the live store (`store.addData`), which triggers an incremental d3-force re-run seeded from current positions: existing nodes stay put and only the new neighbours fan out.
