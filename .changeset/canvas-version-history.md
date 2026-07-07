---
"invana": minor
---

Explorer canvas version history + live banner (RFC-047). The sessions-list
canvas preview now refreshes on a ~10s throttled autosave while a canvas is
open — not only when you switch away — so it stays current as you build. Each
canvas-mutating turn (a query, a node expand, or a load-to-canvas) is also
captured as an immutable `CanvasState` in an append-only history: a new
`canvas_states` table (snapshot + node positions + a banner thumbnail + a
label, provenance-linked to its thread turn), a nested API under
`…/canvases/{id}/states` (list / detail / create + a `…/states/{id}/fork`
restore), and a **History** panel in the canvas header. Each entry shows its
banner thumbnail and time; "Open as new canvas" forks that state into a fresh
session + canvas (non-destructive — the current canvas is untouched). Snapshots and images use the canvas engine's own
`exportState()` / `exportDataURL()` (`@invana/canvas` ≥ 0.0.11) and restore via
`importState()`. To keep the append-only history compact, thumbnails are exported
small (~288px), the snapshot is gzipped at rest (~5–10×), and each canvas keeps
its newest `INVANA_CANVAS_HISTORY_LIMIT` states (default 30).
