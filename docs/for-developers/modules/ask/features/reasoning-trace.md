# Reasoning trace

The whole run, after the fact: every step with its prompt, its rationale, the query it generated, the
records it read, what it cost, and which skills and rules it was offered.

> ⚠ **Rewritten for orchestration § 0** — `Todo` · `Flow` ·
> `Task` · `TaskRun` · `Lens`. The words *Thought*, *Thinking* and *Step-as-a-record* are retired, and
> **`Task` now names a node inside a plan**, never a thing a user authored. Migration:
> task-model-migration.md.

| | |
|---|---|
| Index | [3.7](../../../README.md#3--ask) · Slice **S9c** |
| Module | [Ask](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [streaming-and-the-workflow](streaming-and-the-workflow.md) (while it runs) · evidence |

Product spec: [EX-F04 · The answer](../../../../../specs/capabilities/explore/features/EX-F04-the-answer/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| Thread | Any step row expands into its trace |
| Task | The same trace, reached from the task that triggered the run |
| Trace panel | Steps stacked; the selected step's detail beside them |

## Engine

| Thing | Shape |
|---|---|
| `task_runs` | prompt, rationale, generated query, counts, timings, tokens, `skills_offered`, `skills_applied`, `rules_cited`, `plan_origin` |
| Nesting | `parent_run_id` for delegated runs |
| Routes | `GET …/task_runs/{id}/trace` |
| Retention | payloads purge with their window; step rows and counts survive |

## Decisions

In [EX-F04 · The answer](../../../../../specs/capabilities/explore/features/EX-F04-the-answer/feature.md) › Decisions.

