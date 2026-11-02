# Run a workflow

Start a plan from the library, with its arguments, as a run of its own. The front door the runtime
always assumed and the product never built.

> ⚠ **Rewritten for [orchestration § 0](../../../orchestration.md#0-the-records)** — `Todo` · `Flow` ·
> `Task` · `TaskRun` · `Lens`. The words *Thought*, *Thinking* and *Step-as-a-record* are retired, and
> **`Task` now names a node inside a plan**, never a thing a user authored. Migration:
> [task-model-migration.md](../../../building-engine/task-model-migration.md).

| | |
|---|---|
| Index | [7.5](../../../README.md#7--workflows) · Slice **S15** |
| Module | [Workflows](../spec.md) |
| API / CLI / Studio | 🔵 / 🔵 / 🔵 |
| Related | [the-library](the-library.md) (what is startable) · [envelope-validation](envelope-validation.md) (the check before dispatch) · [the runtime](../../platform/features/runtime.md) (§13 — the trigger table) · [see-what-ran](../../operate/features/see-what-ran.md) (where it lands) · [schedules](../../operate/features/schedules.md) (the same start, on a cron) · [load-a-bundle](../../bring-data-in/features/load-a-bundle.md) |

Product spec: [AG-F06 · Plans and functions](../../../../../specs/products/agents/features/AG-F06-plans-and-functions/feature.md) — AG-44; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Engine

| Thing | Shape |
|---|---|
| `workflow_versions` gains | `inputs` jsonb — the declared argument schema, checked at start |
| The run | an ordinary `Todo` + `Run`. **No new tables** |
| Recorded on the run | `plan_origin` · `plan_version` · `triggered_by = user` · the resolved arguments |
| Routes | `POST …/workflows/{key}/runs` · `POST …/workflows/{key}/runs?dry_run=true` |
| CLI | `invana workflows run` · `invana workflows list` |
| Events | `run.queued · started` and the rest of the closed set. No start vocabulary of its own |

## Decisions

Engine rows; the product decisions are AG-F06's.

| # | Decision |
|---|---|
| RW8 | `idem_key` makes a repeated start return the existing run. |
