---
"studio": minor
"invana": patch
---

Every work canvas draws on the shared canvas. `plan` · `workflow` · `envelope` · `lineage` now render through `@invana/canvas-react` — the Explorer's and Modeller's stack with different settings: ELK `layered` left→right, circle nodes labelled below, solid edges for required order and dashed labelled ones for bindings, click-to-select (nodes *and* edges) feeding the panel's detail. The bespoke SVG renderer is gone, and with it its own answers for layout, edge labels, fit, zoom and theme — including two bugs it had: every stroke painted black (an invalid `var(--token)` paint) and an eight-step workflow drawn as one clipped 2,100px row. Each work canvas now opens as a named tab with a close, and the status line reads its kind and counts — `LIBRARY · 8 steps · 3 agents · served 91% of 34 runs`.

The Plan canvas's drag-to-depend is now a **Connect** tool with a rubber-band preview; it still vetoes the local insert and posts to the dependency endpoint, so a rejected dependency is never left drawn. Both ELK entries in the Explorer's layout picker work again — they hung silently, because the layout package's default worker never answers under Vite.

The engine derives a workflow's DAG as a **partial order** rather than the stored list: `GET …/workflows/{key}` ships per-step `depth`, order edges from `require` rules and `${steps.X.y}` bindings, and independent branches converge instead of chaining — `nl-compare`'s two readings no longer claim the second waits on the first. The library also reports `runs`, `served_rate` (over verified runs; `null`, never 0%, when nothing has been verified) and `last_run_at`, shown on the rows, in the detail and in the status line.
