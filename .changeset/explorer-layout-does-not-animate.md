---
"studio": patch
---

The Explorer draws a result in a fraction of the time. A 60-node query now lands on the canvas ~0.3s after the answer instead of ~2s, and hover, pan and zoom no longer stutter.

- **The layout does not animate** (GC8): a query or an expansion is drawn once, at its settled positions, instead of repainting on every tick — and a node no longer drifts out from under the cursor.
- **A type's colour is resolved once per theme**, not once per node per restyle; each resolve forced a full-page style recalculation.
- **The renderer check probes once.** It created a WebGL context on every render, so the browser evicted the oldest — sometimes the canvas's own.
- **The renderer banner is canvas-ui's** `RendererCapabilityBanner` (canvas-ui coverage B5); Studio's copy is gone.
