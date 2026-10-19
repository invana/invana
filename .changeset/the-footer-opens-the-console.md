---
"invana": minor
---

The Explorer's footer opens the console (docs/for-developers/modules/explore/features/the-console.md).

**The footer.** With a canvas in front it reads `Neo4j 5.26 · connected  43 nodes · 25 relationships
2 queries │ <message>` on the left and `3 selected  104%  WebGPU · 60 fps` on the right. The counts
open the console on Data and on Queries; clicking the open one collapses it. A failed query puts a
dot on the query count. The message line shows what the pointer is over, a layout's progress, or
the gesture of the select mode just picked (*Shift + drag a rectangle to select what is inside*).

**Data** is everything on the canvas, one table per node label and relationship type with that
label's own columns, 20 records a page, as a table or JSON. A row selects its element.

**Queries** lists every query this session ran, newest first — status, the query, language, when,
how long, rows, and the question that ran it. A row opens the query's step as its run page draws it
(Overview · Touched · Log), with Re-run and a link to the whole run. A query that fails opens on its
step's Log. The console's Records · Query · Log tabs are gone.
