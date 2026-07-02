---
"studio": patch
---

Upgrade the `@invana/canvas` rendering family to `0.0.9` (`@invana/canvas`,
`@invana/canvas-react`, `@invana/graph`, `@invana/graph-layout-d3-force`,
`@invana/graph-layout-elkjs`). The packages are version-locked via exact peer
dependencies, so they move together.

Migrated the Explorer and Modeller canvases to the 0.0.9 API:

- Toolbar section hooks (`useHistorySection` / `useViewSection` /
  `useStyleEditorSection`) no longer take an `icons` option — icons are now applied
  to the returned items via `applyIconOverrides`, and per-option edge-routing icons
  are set on the `select` item's `icons` field.
- `isWebKit` was removed from `@invana/canvas-react`; the renderer-capability banner
  now uses `hasWebGPUApi` to detect the Safari/WebGL fallback case.
- The layout-freeze bridge listens on the `input:node:drag:start` global event
  (the `shape:pointerdown` / `connector:pointerdown` renderer events are no longer
  on the global bus).

The 0.0.9 layout packages now run their solvers in Web Workers, so the Vite dev
config was updated: `@invana/graph-layout-d3-force` / `@invana/graph-layout-elkjs`
are excluded from `optimizeDeps` (pre-bundling breaks their `new URL(…,
import.meta.url)` worker paths), `elkjs/lib/elk-api.js` is pre-bundled for CJS
default-export interop (with `elkjs` added as a direct dependency so it resolves),
and `pixi.js` / `pixi-viewport` are deduped since `@invana/canvas` now depends on
them directly.
