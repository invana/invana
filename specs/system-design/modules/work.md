# Work items and assignment — `projects` · `agents`

The engine shape of how work is organised, assigned, run and accepted inside a Graph — for people and agents alike:
the same Todo goes to either, and the same acceptance closes it. The product rules are
[Projects](../../capabilities/projects/product.md) and its features PJ-F01 to PJ-F05. The Todo, Flow, Task and TaskRun
records are [orchestration.md](../orchestration.md); the agent an assignment names is [agents.md](agents.md). On screen
a Todo is a *task* ([glossary.md](../../glossary.md)).

## What it owns

| Owns | Shape |
|---|---|
| `projects` | `graph_id` · `key` (unique per Graph, URL-safe) · `name` · `description` · `status` (`active` · `archived`) · `type` · `question` · `visibility` (`graph` · `private`) · `created_by_kind/id` |
| `project_branches` · `project_findings` · `branch_findings` · `project_decisions` · `project_proposals` | Branches, findings, decisions and an agent's proposals ([PJ-F03](../../capabilities/projects/features/PJ-F03-branches-findings-and-decisions/feature.md)) |
| `project_reports` · `project_report_versions` | [PJ-F05](../../capabilities/projects/features/PJ-F05-project-reports/feature.md) |
| `project_simulations` | The project's handle on a simulator run ([PJ-F04](../../capabilities/projects/features/PJ-F04-simulation-and-impact/feature.md)) |
| `project_assignments` | `project_id` · `principal_kind` (`user` · `agent`) · `principal_id` · `assigned_by_*` · `assigned_at` |
| `todos` | `graph_id` · `project_id?` · `title` · `body` (the prose a planner reads) · `assignee_kind/id?` · `created_by_kind/id` · `due_at?` · `lens_id?` · `closed_at?` · `outcome?` — **no `status` column** |
| `todo_dependencies` | `todo_id` · `depends_on_id` · `on` (`success` · `failure` · `any_outcome`) — a cycle is rejected with the loop named |
| `objectives` · `criteria` · `criterion_outcomes` | [PJ-F02](../../capabilities/projects/features/PJ-F02-objectives-and-review/feature.md) |

| Not owned | Owner |
|---|---|
| Agents, skills, plans and their bounds | [agents.md](agents.md) · [skills.md](skills.md) · [workflows.md](workflows.md) — Work assigns to an agent, never defines one |
| Schedules | [operate.md](operate.md) — a schedule names an agent and instructions, not a project |
| Rules | [MO-F06](../../capabilities/model/features/MO-F06-rules-agents-work-by/feature.md) |

- A Todo needs no project — its Graph's *No project* bucket — and may have no plan at all: a person simply does it.

## A Todo has no status — it has runs

What a surface shows is derived from the Todo's latest run. Acceptance, the one fact a run cannot carry, stays a column.

| Shown | Derived from |
|---|---|
| `open` · `assigned` | No run yet — *assigned* is no run yet, with an assignee |
| `in_progress` | A run is open |
| `needs_input` | That run has an unanswered `task_prompt` of `kind = clarification` |
| `blocked` | An unmet `depends_on` edge, a paused agent, an exhausted budget, or an open child |
| `review` | The run settled and `closed_at` is null |
| `done` · `failed` · `cancelled` | `closed_at` set, with the `outcome` |

| Written by | Column |
|---|---|
| Accept · reject — a person, and only a person | `closed_at` · `outcome` |
| Everything else | Nothing — it is read off `task_runs` |

- An agent never marks its own Todo done. An evaluator run (`role = evaluate`) may write a verdict; a verdict is not an
  acceptance, and `closed_at` has exactly one writer. That seam feeds plan verification.
- Who may write each run field is [orchestration.md › Who writes each field](../orchestration.md#who-writes-each-field).

## Staffing and permission

| Rule | Detail |
|---|---|
| Membership and roles are the permission | Graph membership decides who reads; a Graph role decides who writes ([identity-and-access.md](identity-and-access.md)) |
| A private project adds its people on top | Only the principals in `project_assignments` see it |
| Staffing is a default, not a grant | On a `graph` project, a row in `project_assignments` puts the principal in that project's assignee picker and nothing more |
| An unstaffed agent can still be assigned | Explicitly, by a member |
| Archiving freezes | An archived project's Todos go read-only; running runs finish |

## Order

Dependencies give a derived order; nobody maintains it by hand.

| Derived | Is |
|---|---|
| `wave` | How many `depends_on` hops from the start |
| `blocked_by[]` | The unmet dependencies, named |
| `critical_path` | The longest success chain; failure edges never inflate it |
