# Recurring Todos and conditions

A Todo template on a cron, and dependencies that fire on failure as well as success — so the work that
happens every day opens itself, and the work that only matters when something breaks has a way to say
so.

> ⚠ **Rewritten for [orchestration § 0](../../../orchestration.md#0-the-records)** — `Todo` · `Flow` ·
> `Task` · `TaskRun` · `Lens`. The words *Thought*, *Thinking* and *Step-as-a-record* are retired, and
> **`Task` now names a node inside a plan**, never a thing a user authored. Migration:
> [task-model-migration.md](../../../building-engine/task-model-migration.md).

| | |
|---|---|
| Index | [9.4](../../../README.md#9--work) · Slice **S12e** |
| Module | [Work](../spec.md) |
| API / CLI / Studio | 🔵 / — / 🔵 |
| Related | [projects-and-tasks](projects-and-tasks.md) · [schedules](../../operate/features/schedules.md) |

Product spec: [PJ-F01 · Projects and tasks](../../../../../specs/products/projects/features/PJ-F01-projects-and-tasks/feature.md) — PJ-18 (dependencies with conditions); the story, its criteria, journey, states and product decisions live there. This file keeps the engine shape and the recurring-task templates the product spec does not take, because they contradict the one kind of schedule ([AG-F07](../../../../../specs/products/agents/features/AG-F07-schedules/feature.md)).

## Not moved — recurring task templates

A task template on a cron that creates a new task each firing. It stays here, unmoved: the product spec has one kind of
schedule, an agent and instructions, and whether a run creates work is the run's business. Open question for Ravi in
PJ-F01. If it is taken up, it becomes a story in the schedules feature.

| # | Capability | Notes |
|---|---|---|
| C1 | A task template plus a cron | Title pattern, body, project, assignee, criteria |
| C2 | Each firing creates a **new** task | Not a reopened one — history stays per occurrence |
| C3 | A person still accepts | Recurrence automates the creating, never the accepting |
| C4 | Overlap policy | `skip · queue · allow`, stated on the schedule |
| C5 | A skipped firing is recorded | With its reason; nothing vanishes |
| C6 | Placeholders in the title | `Trade day {date}` — resolved at firing |

| Seam | What the user sees |
|---|---|
| Instance still open at the next firing | The policy decides, and the firing is listed either way |
| A recurrence paused | Firings stop; existing instances are untouched |
| Template edited | Future instances use it; open ones keep what they were created with |
| Cron that would fire in the past | Refused at save, with the next valid time shown |

| Decision | |
|---|---|
| RC1 | Each firing creates a new task; instances are never reopened. |
| RC2 | Recurrence automates creation, never acceptance. |
| RC3 | A skipped firing is recorded with its reason. |

| Not building | Because |
|---|---|
| Recurring *questions* creating tasks | question schedules stack answers; that separation is deliberate |
| Complex calendars — holidays, business days | a cron plus a skip policy covers the need without a calendar engine |

## Engine

| Thing | Shape |
|---|---|
| `schedules` (`kind = task`) | cron · template · overlap policy · assignee. **This kind creates work a person accepts** — a recurring *run* is `kind = workflow` ([SC6](../../operate/features/schedules.md)), not a Todo |
| `firings` | per occurrence: created Todo, or skipped with a reason |
| `todo_dependencies.on` | `success · failure · any_outcome` |
| Derived order | failure edges excluded from `critical_path` |
| Events | `schedule.fired · skipped` · `Todo.created` |

## Decisions

Engine rows; the product decisions are PJ-F01's.

| # | Decision |
|---|---|
| RC4 | Failure edges are contingency and never inflate the critical path: `critical_path` excludes `todo_dependencies.on = failure`. |
