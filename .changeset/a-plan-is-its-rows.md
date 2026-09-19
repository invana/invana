---
"invana": patch
---

A plan is its rows.

A workflow was a `spec` blob: an ordered list of steps in a jsonb column, with the order between
them re-derived on every read. It is **`task_plans` + `tasks`** now — one row per node, with the
predecessors written down.

**Deriving the order on every read is how a plan ends up carrying an edge nobody meant.** A step
that binds nothing and requires nothing was joined to whatever was open, as a guess, and a guess
re-made on every read is never reviewed. Each edge is now materialised once, when the plan is
written, and records *why* it is there — `binding` (its output feeds this node), `require` (the
catalogue declares it), or `sequence` (the fallback).

Reviewing the builtins against that found one: **`nl-single` was hiding a data-flow.**
`validate_query` and `execute_graph_query` both read the query `translate_thought` produced, and
`nl-compare` says so with `${steps.translate_a.query}` — but the linear tail left it implicit and
relied on `RunVars`, so the edge recorded as a guess rather than as the fact it is. It declares the
binding now. The value is identical; the plan no longer understates what it knows. The only
`sequence` edges left are *Verify* following the work it summarises, and a test pins that set so a
new one cannot appear unreviewed.

`workflows.source` becomes `task_plans.origin`, with four values rather than three: `builtin` ·
`authored` · `promoted` are the library's badge, and `generated` is the fourth — a plan drafted for
one Todo, never listed, because browsing plans that can never be selected again makes a library a
log. What was `candidate` reads `generated` and drops out of the list.

**`tasks` now means the plan node.** The table a Todo lived in is `todos`, and
`task_dependencies` is `todo_dependencies`. A Todo is what a person writes down; a Task is what the
runtime dispatches, and `tasks.task_plan_id` is `NOT NULL` — that constraint *is* the rule that
nothing a person authors is ever a Task.

The routes follow: `…/workflows` is `…/task-plans`, and `/{key}/tasks` answers the nodes and the
order between them, because the plan **is** its tasks.
