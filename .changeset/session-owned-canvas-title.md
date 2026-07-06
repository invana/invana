---
"studio": patch
---

Explorer: one name for a session and its canvas. A session and its 1:1 canvas
used to carry separate titles ("New session" in the breadcrumb vs. "Untitled
canvas" on the tab), which read as redundant. The session's title is now the
single name (RFC-045): the canvas tab shows the session title, and the tab's
pencil renames the session — its title updates in both the breadcrumb and the
tab. An unnamed session reads "New session" in both places. The edit dialog
still lets you describe the canvas's **purpose**, which stays canvas-scoped.
