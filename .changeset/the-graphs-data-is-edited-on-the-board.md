---
"invana": patch
---

A graph's data is edited on its board. In Edit, *Add node* and *Connect* draw new elements, and the Element panel edits what is clicked or drawn, with types and keys taken from the graph's published model. Unsaved changes are marked on the board and listed in the Changes panel, which saves them to the graph in one run (`POST /api/v1/u/{u}/{g}/data-edits`). Save is disabled, with the reason, for a member below contributor, on a read-only connection, and on a graph with no published model (4.7).
