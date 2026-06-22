---
"studio": minor
---

Explorer UX fixes and polish.

- **Node/edge "details" context-menu item** — right-click a node or edge → opens the inspector for that element.
- **Inspector defaults closed** — the property-detail panel no longer auto-opens on navigation; it opens only when you ask (header toggle, or a "details" menu item). Re-opening the messages panel no longer forces the inspector open.
- **Expanded graph is preserved when collapsing the messages panel** — collapsing/expanding the sessions panel remounts the canvas (a layout-shell quirk); the canvas now reseeds with the full current contents, so node-expand neighbours aren't lost.
- **Session thread auto-scrolls** to the latest message on open and whenever a message or result is added.
- **Looser, faster-settling force layout** so large node-expansions read as a graph instead of a crowded blob.
- **Clarification "let me type instead"** option that focuses the composer.
