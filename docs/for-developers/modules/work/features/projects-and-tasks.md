# Projects and Todos

> ⚠ **Rewritten for orchestration § 0.** What this file
> used to call a *Task* is a **Todo**; `Task` now names a node inside a Flow. A Todo has no
> `status` column — state derives from its runs. Migration:
> task-model-migration.md.

Write a Todo, assign it to a person or an agent, watch it run, accept the result. Dependencies give a
derived order — nobody maintains a plan by hand.

| | |
|---|---|
| Index | [9.1](../../../README.md#9--work) · Slice **S12b** |
| Module | [Work](../spec.md) |
| API / CLI / Studio | 🟡 / — / 🟡 |
| Related | [objectives-and-criteria](objectives-and-criteria.md) · [review](review.md) · [author-an-agent](../../agents/features/author-an-agent.md) |

Product spec: [PJ-F01 · Projects and tasks](../../../../../specs/capabilities/projects/features/PJ-F01-projects-and-tasks/feature.md) — PJ-01 · PJ-12 · PJ-15; the story, its criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Engine

| Thing | Shape |
|---|---|
| `projects` · `project_assignments` | key, name, description, status, `created_by_*`; staffing by principal |
| `ProjectRead.created_by_name` | Resolved from `created_by_id` in one query per list — the panel never asks per row |
| `PATCH …/projects/{key}` `status` | `archived` ⇄ `active`; emits `project.archive` one way and `project.unarchive` the other |
| `todos` | project, parent, title, body, assignee principal, due, `lens_id?`, `closed_at?`, `outcome?`. **No `status`** — it derives from the Todo's runs ([Work §3](../spec.md)) |
| `todo_dependencies` | `on (success\|failure\|any_outcome)`, cycles rejected |
| Derived | `wave` · `blocked_by[]` · `critical_path` |
| Routes | `…/projects*` · `…/todos*` · `/start · /result · /accept · /reject · /cancel` · `GET …/projects/{key}/plan` |
| `ProjectSummary` | `GET …/projects/{key}/summary` — see the table below |
| Events | `Todo.created · assigned · started · result_posted · accepted · rejected · blocked` |

| `ProjectSummary` field | Meaning |
|---|---|
| `branches` · `branches_by_status` | Every branch; how many sit in each status, a status with none absent |
| `findings` · `findings_reviewed` | Every finding in the project; how many a person reviewed |
| `datasets` | Distinct datasets its findings cite, any version |
| `todos_by_status` | The project's own Todos per status, a status with none absent |
| `todos_open` · `todos_open_for_agents` | Todos not `done` · `failed` · `cancelled`; of those, assigned to an agent |
| `decisions` | Every decision in the project, superseded ones included |
| `critical_path` | Length of the plan's critical path — the same derivation `…/plan` returns |

## Decisions

Engine rows; the product decisions are PJ-F01's.

| # | Decision |
|---|---|
| PT16 | **A Todos count of part of the list is the engine's.** `GET …/tasks` returns `by_status` beside `total` — how many of the listed Todos sit in each status, a status with none absent — and the drawer's `12 · 3 in review` and the status bar's `2 running` · `3 in review` read it. Studio filters the loaded rows to draw them, never to count them. |
| PT17 | **A project's counts are one engine summary.** `GET …/projects/{key}/summary` returns every count the Overview tiles and the detail's status bar show, computed by `ProjectSummaryManager` from the rows the lists read — branches, findings, the findings' dataset cites, the project's own Todos, decisions, and the plan's derivation for the critical path. Studio formats it and counts no list. A task from another project drawn on the plan is not this project's work and is not counted. A tab count or a box count over a list fully on screen stays Studio's. |
