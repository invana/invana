---
"invana": patch
"studio": patch
---

Every clarifying round shows up in the turn's timeline.

A run can pause more than once — the model asking one thing, then another, to
pin the question down. Studio only ever rendered one of those rounds: each
resumed reply's steps replaced the paused ones, so an earlier question and its
answer fell out of the timeline entirely. All rounds now hang under the step
that asked them, in order — `asked: "…1"` / `you answered: "A"` /
`asked: "…2"` / `you answered: "B"` — instead of one round surviving or each
round stacking up a duplicate step row. The options for a round disappear with
its answer (they were the live way to answer it); the full set stays in the
step's trace, along with the question.

Engine-side, a paused thinking's cursor now carries the question as well as the
resume point, and the attempt that continues the run records it as
`input.answering`. Each round was already durable — its own ask reply with
`clarification_options`, its own user answer, its own Understand attempt, all on
one thinking — so a reload rebuilds the whole exchange; the new field is what
makes a *single* step's trace say which question it was answering.

Two smaller fixes in the same view: a reply with steps no longer shows a
turn-level status dot next to the step dots (two statuses for one row — blue
beside amber while waiting for an answer), and a **Load to canvas** click no
longer breaks the indentation by starting a turn of its own. That operation turn
folds into the reply that offered it, as `└ you loaded this to canvas` under its
Project step, so the load reads as part of the task it belongs to (and still
reads that way after a reload, not just right after the click).
