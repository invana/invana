---
"studio": patch
---

Make the Canvases rail `+` create a new canvas.

The Canvases panel's `+` button was wired to "save the current view" — confusing,
since `+` universally means create. It now starts a fresh blank canvas (a new
session + empty tab). The current view is persisted automatically when its tab is
switched or closed, so the separate manual "save" action is gone.
