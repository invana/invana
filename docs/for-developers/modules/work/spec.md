# Work — module spec

How work is organised, assigned, run and accepted inside a Graph. Covers people and agents equally:
the same Todo can go to either, and the same acceptance closes it.

> ⚠ **Rewritten for [orchestration § 0](../../orchestration.md#0-the-records).** The word **Task**
> has flipped: what this module used to call a Task is now a **Todo**, and `Task` names a node inside
> a TaskPlan — which this module does not own. Migration: [task-model-migration.md](../../building-engine/task-model-migration.md).

| | |
|---|---|
| Index | [§5 · Work](../../README.md#5--work) |
| Features | [projects-and-tasks](features/projects-and-tasks.md) · [objectives-and-criteria](features/objectives-and-criteria.md) · [review](features/review.md) · [recurring-tasks-and-conditions](features/recurring-tasks-and-conditions.md) |
| Depends on | [Agents](../agents/spec.md) (the assignee, and what it may run) · Ask (a Todo runs as a TaskRun) · Explore (the canvas the panel selects from) |

## 1. Vocabulary

Product-wide words are pinned in [terminology.md](../../terminology.md). What this module adds:

| Noun | Is | Is not |
|---|---|---|
| **Project** | a piece of work inside a Graph — a folder of **Todos**, staffed by principals. Its own record: it never runs, has no criteria and no plan | a permission scope · a Task · nestable — there are no sub-projects |
| **Todo** | one unit of work a person wrote, with a definition of done | a Task · a runtime step · a plan |
| **Staffing** | appearing in a project's assignee picker | a grant of access |

**A Todo is not a run, and a Task is not a Todo.** A Todo is work with a definition of done; a
**TaskRun** is one execution; a **Task** is one node inside the TaskPlan that run is executing. A
plan's Tasks — an LLM call, a query, a decision box, a graph algorithm — are Tasks, never Todos.
Nobody accepts a load, so no plan node has a definition of done. The only child run a run gets is a
[delegation](../agents/features/delegation.md), and that child is a run too. All of them are listed
in one place: [Runs](../operate/features/see-what-ran.md).

A Todo may exist without a Project — its Graph's "No project" bucket — so small Graphs never need a
default project. And a Todo may have **no plan at all**: a person simply does it.

## 2. What this module owns

| Owns | Shape |
|---|---|
| `projects` | `graph_id` · `key` (unique per Graph, URL-safe) · `name` · `description` · `status (active\|archived)` · `created_by_kind/id` |
| `project_assignments` | `project_id` · `principal_kind (user\|agent)` · `principal_id` · `assigned_by_*` · `assigned_at` |
| `todos` | `graph_id` · `project_id?` · `parent_id?` · `title` · `body` (the prose a planner reads) · `assignee_kind/id?` · `created_by_kind/id` · `due_at?` · `lens_id?` · `closed_at?` · `outcome?`. **No `status` column** — see §3 |
| `todo_dependencies` | `todo_id` · `depends_on_id` · `on (success\|failure\|any_outcome)` · cycles rejected with the loop named |
| `rules` · `objectives` · `criteria` · `criterion_outcomes` | [objectives-and-criteria](features/objectives-and-criteria.md) |
| `schedules` | [recurring-tasks-and-conditions](features/recurring-tasks-and-conditions.md). **There is one kind of schedule** — it names a TaskPlan and opens a run. Whether that creates work a person accepts is a property of what it names ([Operate](../operate/features/schedules.md)) |

Agents, skills, workflows and their bounds are the [Agents](../agents/spec.md) module. Work assigns to
an agent; it does not define one.

## 3. A Todo has no status — it has runs

**The status machine is gone.** A definition has no progress; a run does. What a surface shows is
**derived from the Todo's latest run**, and the one fact that was never derivable — acceptance — is
the one that stays a column.

| Shown | Derived from |
|---|---|
| `open` · `assigned` | **no run yet.** Assigned is simply *no run yet, with an assignee* |
| `in_progress` | a run is open |
| `needs_input` | that run has an unanswered `task_prompt` of `kind = clarification` |
| `blocked` | an unmet `depends_on` edge, a paused agent, an exhausted budget, or an open child |
| `review` | the run settled and `closed_at` is null |
| `done` · `failed` · `cancelled` | `closed_at` set, with the `outcome` |

| Written by | Column |
|---|---|
| **accept / reject — a person, and only a person** | `closed_at` · `outcome` |
| everything else | nothing. It is read off `task_runs` |

For the full prompt/verdict rules see
[orchestration § 0.5 D](../../orchestration.md#d-write-authority--the-lane-that-may-write-each-field).

<details><summary>The retired status machine, for reference during migration</summary>

```
open ──assign──▶ assigned ──start──▶ in_progress ──result──▶ review ──accept──▶ done
                     ▲                  │  ▲                    │
                     │                  │  └── answer ◀── needs_input
                     │                  ├──▶ blocked
                     │                  └──▶ failed
                     └──────── reject ◀───────┘
   any ──cancel──▶ cancelled
```

| Status | Meaning | Moved by |
|---|---|---|
| `open` | no assignee | — |
| `assigned` | has an assignee, nothing running | assign |
| `in_progress` | a person is on it, or an agent has a run open | start · the run opening |
| `needs_input` | the assignee asked a question | the run |
| `blocked` | a dependency is unmet, the agent is paused, the budget is out, or a sub-task is open | system |
| `review` | a result is posted, awaiting acceptance | the assignee |
| `done` · `failed` · `cancelled` | terminal | accept · diagnosis · cancel |

</details>

**An agent never marks its own Todo done.** It posts a result; a person accepts. An evaluator
(`TaskRun.role = evaluate`) may write a **verdict**, and a verdict is not an acceptance — `closed_at`
has exactly one writer. That is the governance seam, and the signal that feeds plan verification.

## 4. Staffing and permission

| Rule | Detail |
|---|---|
| Membership is the permission | Graph membership decides who can act; there are no roles |
| Staffing is a default, not a grant | Being staffed on a project means "appears in that project's assignee picker" and nothing more |
| An unstaffed agent can still be assigned | Explicitly, by someone with Graph membership |
| Archiving freezes | An archived project's Todos go read-only; running runs finish |

## 5. Order

Dependencies give a derived order — no one maintains it by hand.

| Derived | Meaning |
|---|---|
| `wave` | how many `depends_on` hops from the start; the Plan canvas groups by it |
| `blocked_by[]` | the unmet dependencies, named |
| `critical_path` | the longest success chain; failure edges never inflate it |

## 6. Surfaces

| Surface | Shape |
|---|---|
| Project panel | one tab strip (`Todos · Plan · Agents · Activity`), sections stacked in the body |
| Todo panel | one tab strip (`Work · Activity · Runs`); acceptance sits at the bottom as a decision bar |
| Plan canvas | Todos as cards, waves as columns; drag card → card writes a dependency |
| Review | one queue across the Graph — questions first, then proposals, then results |

Panel rules: creating lives in the header as an icon; a decision or a commit earns a footer bar;
everything else acts on a row and lives on the row.

## 7. Cross-feature decisions

| # | Decision |
|---|---|
| W1 | A Todo is worked *through* an agent: the agent carries the LLM provider, model and skills, not the composer |
| W2 | Assigning a Todo opens exactly one **root TaskRun**, `triggered_by = task`, on behalf of the assigner |
| W3 | Agents may create Todos — for children, or for a person — from inside a run. **Delegation and `create_task` are the same act**: make a child, optionally run it |
| W4 | Depth is bounded by the envelope, checked when a run opens — not by a fixed constant. Delegation is bounded by depth · fan-out · budget ⊆ parent |
| W5 | Every Task records which skills were **offered** and which were **reported applied** |
| W6 | **A Todo is work, a TaskRun is a run, a Task is a node in a plan.** A Task never becomes a Todo, and no surface calls any of them a *job*. |
| W7 | The Todo panel's `Runs` tab is the Graph's journal ([10.5](../operate/features/see-what-ran.md)) filtered to one `todo_id` — not a list of its own. |
| W8 | **A plan's Tasks are not Todos, at any altitude.** A multi-stage load, stitch or enrichment is a TaskPlan whose nodes are Tasks ([13.8 §3.2](../platform/features/runtime.md)). Nobody accepts a load, so no node has a definition of done. |
| W9 | **A plan produces Todos; it is never made of them.** Where a run needs a person to go and *do* something, a `human` Task raises real work here — that is the only direction the two concepts meet ([13.8 RP30a](../platform/features/runtime.md)). |
| W10 | There is **one kind of schedule**: it names a TaskPlan and opens a run ([SC6](../operate/features/schedules.md)). Whether a firing creates work a person accepts is a property of the plan it names, not of the schedule — which is why a nightly load raises no Todo nobody owns. |
| W11 | **A Todo has no status column.** Its state derives from its latest run; `closed_at` and `outcome` are written by acceptance alone (§3). |
| W12 | **A Project is a record, not a Task.** It never runs, carries no criteria, no plan, no timeout — and there are no sub-projects. Nesting belongs inside the work item, not in the filing cabinet ([orchestration § 0.1](../../orchestration.md#01-reading-the-dependencies)). |
| W13 | **A Todo may have no plan.** A person assigned a Todo with criteria and no steps is the smallest legal case, and it uses no field it does not need. |

## 8. Deliberately absent

| Not built | Because |
|---|---|
| Roles and invitations | membership is binary; anything finer is unproven complexity |
| Soft deletes, trash, undo | archive covers the real need |
| A task board with swimlanes per assignee | the Plan canvas answers "what is next" better than a board does |
| Sub-projects | a Project is a folder; nesting belongs in the Todo's plan |
| A `status` column on a Todo | a definition has no progress; a run does |
| Agents accepting their own work | the governance seam is the product |
