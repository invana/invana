---
"invana": patch
---

A kept report is findable from the board it is of, and a step board survives a reload (B21 · B22 · SR44).

Five reports existed in the dev Graph and no surface listed one: `Save report` wrote a reading and the
only way back to it was a URL somebody happened to keep. A declared board now carries **`Reports`**
beside `Save report`, on the dashboard's own header — a canvas' History is a strip control only
because a canvas has no header to hang one on, so the `data`-only gate on the strip stays exactly as
narrow as it was. The card is the drawn board's card: one shell and one row shape, two bindings —
`boardVersions` by `board_id` for a canvas, `boardReports` by `(kind, subject_id)` for a dashboard.
A report row **opens**; it does not restore. Restoring forks a drawn board because the board you are
standing on is what you would otherwise overwrite, and a report has nothing to fork into — the live
dashboard is derived from its subject on every open, so the row is a link to a reading and the frozen
page's *Open the live board* is the way back.

A live step board opened cold used to refuse by name. `?page=task_run:<id>` is written by the host
itself whenever a step board is focused, so the link that refused was a **reload**, not something
assembled by hand. `task_runs` is one table, so `GET …/runs/{id}` answers for a step as well as for a
run: `TaskRunRead` now carries `parent_run_id`, and a cold open reads the step's own row to find the
trace it belongs to. The id does not grow — putting the run in the address would store a fetched fact
inside an identity, and would key a step's reports on a string half of which is derivable. The warm
path pays nothing: opening a task from the run's flow already holds the run and passes it.

A rule's statement in the **trace dialog** now links to its rule's board. Because the dialog is a
modal, the act is *close the trace, then open the board* — a board opened behind a dialog is a page
nobody can see, and dropping the link would have made the answer surface, where a reader is asking
*why this answer*, the one place a rule could not be reached. The host publishes *open this board*
through a context, so nothing between it and the dialog carries a callback it has no use for.
