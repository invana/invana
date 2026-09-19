---
"invana": patch
---

A run reads end to end in the drawer.

Opening a run used to mean reading a stack of sections — outcome, steps, reported, log, what
landed — that answered the questions in the order they were written rather than the order they
are asked. The **Runs** drawer now answers the three a run is actually opened with, as three
bands:

| Band | Answers |
|---|---|
| `Stats` | *what happened* — written, reported, duration, retries, lanes, cost |
| `Performance` | *where did the time go* — one row per Task on the run's own clock |
| `Log` | *why* — filterable by task and level, taking the height that is left |

**Performance is a Gantt, not a step list.** Duration is the question, and a list of steps with a
duration column answers it one row at a time; a bar placed by start and sized by duration puts the
slow Task, the retry and the branch that never ran in one glance. It reads the trace unchanged —
`task_key` · `status` · `started_at` · `finished_at` are the fields the runtime already records —
so wiring a run to it is a rename rather than a transform.

**Picking a Task filters the log to it.** A Gantt row and a log line are the same Task seen twice,
and now they say the same word for it: the importer stamps every line with the `task_key` its own
trace gave the step, instead of a separate `stage` vocabulary that named the same things
differently. A line belonging to the run rather than to any one Task — `register`, `done`, and
every line of a `bulk` load, which walks no plan — carries `null` and reads at run level.

Picking one also folds the Performance band to a single line. The chart is how a Task is *picked*;
once picked, the height is worth more to the log, and the folded band still names the run's slowest
Task so it goes quiet rather than silent.

**A run in flight and a run that finished are the same three bands.** The Gantt grows a *now* line
and an open-ended axis, the stats climb and the log tails — there is no separate live view to build
or to keep honest.

Two tiles read `—` rather than a number: an import walks no lanes and spends no tokens, and a zero
would claim a measurement where there is an absence. Both fill in when a run writes its own
`result.json`. `Cancel` is likewise absent until the run routes carry it.
