# Streaming and the workflow

The steps are the interface. You watch `understand · plan · translate · validate · execute · project ·
verify` happen, with their emissions appearing as they are produced — never a spinner followed by
everything at once.

> ⚠ **Rewritten for [orchestration § 0](../../../orchestration.md#0-the-records)** — `Todo` · `Flow` ·
> `Task` · `TaskRun` · `Lens`. The words *Thought*, *Thinking* and *Step-as-a-record* are retired, and
> **`Task` now names a node inside a plan**, never a thing a user authored. Migration:
> [task-model-migration.md](../../../building-engine/task-model-migration.md).

| | |
|---|---|
| Index | [3.5](../../../README.md#3--ask) · Slice **S9b → S9d** |
| Module | [Ask](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [reasoning-trace](reasoning-trace.md) (after the fact) · [plan-selection](../../workflows/features/plan-selection.md) |

Product spec: [EX-F04 · The answer](../../../../../specs/products/explore/features/EX-F04-the-answer/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| Thread | A row per step, expanding to its detail; emissions between them |
| Step row | Name · state · duration · tokens · skills offered / applied |
| Header | Cancel while running; the agent and the plan named |

## Engine

| Thing | Shape |
|---|---|
| Stream | server-sent events per run: step transitions and emissions |
| `task_runs` | one row per step with state, timings, tokens |
| Resume | the stream replays from the last delivered sequence |
| Routes | `GET …/task_runs/{id}/stream` · `POST …/task_runs/{id}/cancel` |

## Decisions

| # | Decision |
|---|---|
| SW4 | The stream resumes after a reload from the last sequence delivered. |
| SW5 | **A finished step carries its run's spend so far.** Every `step.finished` frame has `run_tokens` — the root's own tokens plus its nodes' to that moment, summed by the engine — so the assistant's live strip shows `↑ 12k tokens` without adding anything. |

