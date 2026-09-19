---
"invana": patch
---

The record is a TaskPlan, and the code says so.

M2 renamed the tables and the routes and left the code around them saying *workflow*: an
`apps/workflows` package whose model class was already `TaskPlan`, a `WorkflowRead` over a
`task_plans` row, a `server/workflows` module serving `…/task-plans`. The word survived in the one
place a reader looks first.

`apps/workflows` → `apps/task_plans`, `server/workflows` → `server/task_plans`,
`managers/workflow.py` and `querysets/workflow.py` → `task_plan.py`, `runtime/managers/workflow_runs.py`
→ `task_plan_runs.py`, and `WorkflowRead` · `WorkflowDetail` · `WorkflowListResponse` ·
`WorkflowRunsManager` · `WorkflowView` take the record's name. Studio's contract types follow, and
`WorkflowsPanel.tsx` becomes `TaskPlansPanel.tsx`.

**No URL moved and no table moved** — the OpenAPI diff is three component names and nothing else.

Three uses of the word are deliberately left. `plan_workflow` is a catalogue key stored in
`thinking_steps.task_key` and read by Studio, frozen by the migration's own §6.1 — renaming it is a
data migration, not a rename. `agents.workflow_spec` is a column, and the envelope change that
retires it is its own slice. And `runtime/`'s `workflow_key` hangs off `thinkings`, a table M3
deletes outright; renaming a column on the way to dropping it buys nothing.

*Workflow* is still a product word — [terminology](../docs/for-developers/terminology.md) keeps it for
a **reusable TaskPlan in a role**. What it is not is the name of the record, and the code no longer
says it is.
