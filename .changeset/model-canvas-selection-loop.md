---
"studio": patch
---

Stop the model canvas from looping when a type is selected.

Clicking a node or edge type on the model canvas could put the page into an
endless render cycle ("Maximum update depth exceeded"), which tore the canvas
down mid-frame and surfaced as a PixiJS teardown error. The canvas announced its
inspect target again on every render, the handler answered with a fresh
selection object, and that write re-rendered the canvas. The announcement now
follows the target alone, and a selection that is already held is not written
again. The drawing is also no longer rebuilt on every render while a model
version is still loading.
