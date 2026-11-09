# Promote a plan

A plan the *Verify* step judged as having served becomes a candidate. A person promotes it into the
library, named by intent. That is how workflows get authored.

> ⚠ **Rewritten for orchestration § 0** — `Todo` · `Flow` ·
> `Task` · `TaskRun` · `Lens`. The words *Thought*, *Thinking* and *Step-as-a-record* are retired, and
> **`Task` now names a node inside a plan**, never a thing a user authored. Migration:
> task-model-migration.md.

| | |
|---|---|
| Index | [7.4](../../../README.md#7--workflows) · Slice **S12c** |
| Module | [Workflows](../spec.md) |
| API / CLI / Studio | 🟡 / — / 🟡 |
| Related | [the-library](the-library.md) · [plan-selection](plan-selection.md) · proposals |

Product spec: [AG-F06 · Plans and functions](../../../../../specs/capabilities/agents/features/AG-F06-plans-and-functions/feature.md) — AG-31; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Engine

| Thing | Shape |
|---|---|
| Candidate | derived: a run whose Verify step passed and whose plan was generated |
| Promotion | publishes a `workflow_version` with `created_from_run_id` |
| Routes | `POST …/task_runs/{id}/promote` |
| Events | `plan.promoted` |
