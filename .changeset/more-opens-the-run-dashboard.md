---
"invana": patch
---

`More` on a run opens its dashboard, and a task on it opens its own.

The Runs drawer has always been an overview: what the run is, and the Gantt. Everything past
that — the flow, the full log, what each task was asked and what it produced — had nowhere to
go, so it was nowhere. `More` now opens the **run dashboard** as a page beside the canvases,
and clicking a task on its flow opens that task's own dashboard, breadcrumbed under the run
with `‹ ›` to the task before and after.

Both are composed with `@invana/dashboard` from a single `GET …/runs/{id}/trace`. A dashboard
is **data**: the page fetches, a composer turns the trace into a `DashboardSpec`, and the
renderer draws it. The `Dashboard ¦ spec.json` switch on each shows the very document being
rendered, so "a dashboard is data" is checkable rather than claimed.

There is **one shell for every kind of task**, and only the Output band differs — and it is
picked from the shape the task *recorded*, never from its key: rows draw as a table, a prompt
and a completion as the exchange, records written as what landed in the graph. A new
catalogue entry gets a surface by recording one of those shapes.

A band with no record behind it is **absent, not zero**. There is no `usd` column, so no Cost
tile; `task_runs.result` is declared and unwritten, so no `result.json` band and no artifacts.
A dashboard that showed an empty Artifacts box would be saying the task produced none.

Two bugs surfaced on the way, both from a rename that landed on one side only:

- `GET …/runs/{id}/trace` raised a `ValidationError` on **every** call — it passed
  `parent_run_id` to a model whose field is `run_id`, so the whole trace endpoint was dead.
  It is fixed, and a test now checks each keyword the route passes against the model it
  builds, which is where that class of drift is catchable before a request.
- Studio read `plan_source` and `plan_version` from two endpoints that return `plan_origin`
  and `plan_revision`, so a run's title silently fell back to its workflow key and the trace
  dialog never named the plan.
- A delegated run never appeared under the step that spawned it: the trace returns
  `child_run_id`, and the trace dialog looked for `child_thinking_id`.

The trace also returns what the dashboards render, all of it already on the run: a step's
resolved `args`, the `bound` its catalogue entry declares, its `step_key` and `lane`, and
`result`; and the run's own `ask_kind`, `body` and `result`.
