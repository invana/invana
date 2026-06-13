---
"studio": minor
---

Add a live canvas status bar and message bar to the Explorer footer.

The Explorer footer now mirrors the `@invana/canvas-react` visualiser story:
the **left** carries the canvas `GraphStatusBar` — rendered node/edge totals,
zoom, camera pan, pointer world position, the hovered node/edge, and selection
counts — self-wired off the lifted `CanvasContext`. The **right** carries the
shared `CanvasMessageBar`, which surfaces whatever was last pushed via
`Canvas.showMessage` (e.g. a layout's "Running… / ready") and stays empty when
idle.

The manual `nodeCount`/`relCount`/session counters were dropped (the canvas
status bar derives node/edge totals from the engine directly), and the
connection DB URI was removed from the shared graph status chip — leaving just
the connection status. Requires `@invana/canvas-react@0.0.6`, whose status bar
now resolves the hovered label through the layer's `labelText` resolver so the
footer matches the label drawn on the canvas.
