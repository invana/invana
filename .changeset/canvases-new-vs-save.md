---
"studio": patch
---

Split "new canvas" from "save canvas" in the Canvases rail.

The Canvases panel's `+` button was wired to "save the current view" — confusing,
since `+` universally means create. It now has two distinct header actions: `+`
starts a fresh blank canvas (a new session + empty tab), and a new Save button
snapshots the current view onto the active canvas.
