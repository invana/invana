---
"invana": patch
---

A seeded plan is its rows, not its name.

`ensure_seeded` treated a library row as done the moment its key and version were present. Migration
`000000000038` carries the library across from `workflows` and **drops `spec`**, trusting a builtin
to rebuild itself from the registry on the next read — and the carried row keeps exactly the key and
version that identity check matches on. So the rebuild never ran: four builtin plans, zero Task rows,
and a Plans drawer listing four entries that open onto nothing. It would have stayed that way for the
life of the graph, because nothing else re-explodes a plan.

Seeded now means **populated**. `plans_without_nodes` asks which library rows have no Tasks, and a
row holding a builtin's key with none is re-exploded from the registry instead of skipped.

A plan is its rows — that was M2's whole point, and the seeding check was the one place still reading
a plan as a name.
