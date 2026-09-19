---
"invana": patch
---

Execution and definition are two panels: Runs and Library.

The rail had a `Tasks` icon holding three drawers — Runs · Plans · Catalogue — and a `Templates`
icon beside it. That put a journal and the definitions it executes in one 420px column, and gave a
projection template an icon for a surface nobody goes to.

They split along the line that was already there. **Runs** is the journal and nothing else, as one
list: `?panel=runs&run=<id>`, no `?drawer=`, the one-header `ListPanelChrome` grammar every other
list uses, and a drill-in that replaces the body and turns the header into `‹ Runs / orders.csv`.
**Library** is what a run is built from, as a stack: `?panel=library&drawer=plans|catalogue|templates`
with `&plan=` · `&entry=` · `&template=`. It reads as one sentence going down the column — a plan is
a composition of catalogue entries, and a template renders what the plan produced.

Templates loses its icon and becomes Library's third drawer, so it gains what a drawer has and a
panel did not: its own count (`11 · 5 result`), search, a `kind`/`surface` filter, and a drill-in
that reads one template end to end — what it accepts, what rendered with it, and whether it is this
Graph's to change.

The step that used to justify the single column — *this run → the plan it ran* — is better served by
pages: a run's detail is a page, a plan's is a canvas page, and `keepMounted` keeps the run open
beside the plan rather than stacked above it.

`?panel=tasks` and `?panel=templates` are **deleted, not redirected**. They name surfaces that no
longer exist, and a stale link lands on the graph page, which is what an unknown `?panel` has always
done.
