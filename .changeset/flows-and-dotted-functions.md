---
"invana": minor
---

**Breaking.** A plan's record is a **Flow**, and what a step calls is a **function** named `namespace.verb`.

| Was | Is |
|---|---|
| `TaskPlan` · table `task_plans` · `task_plan_id` | `Flow` · table `flows` · `flow_id` |
| `/api/v1/u/{u}/{g}/task-plans…` | `/api/v1/u/{u}/{g}/flows…` |
| `task_runs.workflow_key` · run stream `workflow` | `flow_key` · `flow` |
| event `workflow.promote` · target `workflow` | `flow.promote` · `flow` |
| task types `execute_graph_query`, `translate_thought`, `web.fetch`, … | functions `graph.read.query`, `nl.translate`, `web.read_url`, … |
| step ids `translate`, `query`, … | the function with dots as underscores: `nl_translate`, `graph_read_query` |

No alias is kept. The engine's migrations are squashed into one baseline; a database at the old
head migrates forward and its recorded runs, plan snapshots and events are rewritten to the new
names. Studio says *function* where it said *task type* or *callable*.
