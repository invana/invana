---
"studio": patch
---

The header breadcrumb names the graph again: `owner › graph › screen › object`.

Graph-scoped routes were showing the screen name alone — `Invana Studio |
Explorer` — on a decision recorded only as a comment in `computeSegments`: *"the
owner + graph name are intentionally dropped from the header"*. Every drawing
disagrees. `ExplorerHiFi` draws `ravi › finance › Explorer › Defence theme —
Sep 2026`, and so do both shell references: design-kit's `Themes/AppV2 ›
ExplorerShell` and canvas-ui's `apps/AppLayoutV2`.

The drawings are right. Every graph-scoped screen is inside a graph, and a
header that does not name it leaves the URL as the only way to tell which one
you are in — on a product whose whole premise is that you work inside a bounded
domain.

The last crumb is what is open, not another route: the canvas you are looking
at, named by its session. `GraphDetail` takes `objectLabel` and the Explorer
fills it from the active session, so a screen with nothing open simply ends at
its own name.
