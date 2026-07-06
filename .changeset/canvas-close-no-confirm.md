---
"studio": patch
---

Close canvas tabs without a confirmation prompt.

Closing a canvas tab is non-destructive — the canvas stays saved in the Canvases
list, and the current view (snapshot, node positions, latest query) is flushed to
the backend before the tab closes. The "Close this canvas tab?" dialog added
friction with nothing to warn about, so it's gone; the ✕ now closes immediately.
