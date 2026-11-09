# Work — module spec

| | |
|---|---|
| Index | [§5 · Work](../../README.md#5--work) |
| Features | [projects-and-tasks](features/projects-and-tasks.md) · [objectives-and-criteria](features/objectives-and-criteria.md) · [review](features/review.md) · [recurring-tasks-and-conditions](features/recurring-tasks-and-conditions.md) · [branches-and-decisions](features/branches-and-decisions.md) · [project-reports](features/project-reports.md) · [private-projects](features/private-projects.md) · [simulation](features/simulation.md) · [impact](features/impact.md) |
| Depends on | [Agents](../agents/spec.md) (the assignee, and what it may run) · Ask (a Todo runs as a TaskRun) · Explore (the canvas the panel selects from) |

Product spec: [Projects](../../../../specs/capabilities/projects/product.md) — its features PJ-F01–PJ-F05 hold the stories, surfaces, states and product decisions.

System design: [work.md](../../../../specs/system-design/modules/work.md) — what the module owns, a Todo's derived status and who writes acceptance, staffing and permission, derived order. This file keeps the vocabulary, the retired status machine, the decisions and what it does not build.

## 1. Vocabulary

Product-wide words are pinned in [terminology.md](../../terminology.md). What this module adds:

| Noun | Is | Is not |
|---|---|---|
| **Project** | a piece of work inside a Graph — a folder of **Todos**, staffed by principals. Its own record: it never runs, has no criteria and no plan | a permission scope · a Task · nestable — there are no sub-projects |
| **Todo** | one unit of work a person wrote, with a definition of done | a Task · a runtime step · a plan |
| **Staffing** | appearing in a project's assignee picker — and, on a private project, its access list | a Graph role |
| **Branch** | one line of inquiry inside a project — the type calls it a hypothesis, thesis, option, position or lead | a sub-project · a git branch |
| **Finding** | one piece of evidence on a branch, with a **stance** (`supports · contradicts · context`) and its cites | a criterion's outcome |
| **Project decision** | a person's verdict and decision on a branch, checked by the rules; append-only, superseded never edited | an approval's answer |
| **Project proposal** | an agent's suggested fork or decision, waiting for a person | a memory proposal (8.3) |
| **Simulation** | one run of a simulator plugin on a branch, over pinned dataset versions; its result is `derived` | an observation · a finding — a finding may cite it |

**A Todo is not a run, and a Task is not a Todo.** A Todo is work with a definition of done; a
**TaskRun** is one execution; a **Task** is one node inside the Flow that run is executing. A
plan's Tasks — an LLM call, a query, a decision box, a graph algorithm — are Tasks, never Todos.
Nobody accepts a load, so no plan node has a definition of done. The only child run a run gets is a
[delegation](../agents/features/delegation.md), and that child is a run too. All of them are listed
in one place: [Runs](../operate/features/see-what-ran.md).

A Todo may exist without a Project — its Graph's "No project" bucket — so small Graphs never need a
default project. And a Todo may have **no plan at all**: a person simply does it.

## 3. A Todo has no status — it has runs

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

## 6. Cross-feature decisions

Engine rows; the product decisions are in the Projects product.md and its features.

| # | Decision |
|---|---|
| W4 | Depth is bounded by the envelope, checked when a run opens — not by a fixed constant. Delegation is bounded by depth · fan-out · budget ⊆ parent |
| W5 | Every Task records which skills were **offered** and which were **reported applied** |
| W7 | The Todo panel's `Runs` tab is the Graph's journal ([10.5](../operate/features/see-what-ran.md)) filtered to one `todo_id` — not a list of its own. |
| W8 | **A plan's Tasks are not Todos, at any altitude.** A multi-stage load, stitch or enrichment is a Flow whose nodes are Tasks ([13.8 §3.2](../platform/features/runtime.md)). Nobody accepts a load, so no node has a definition of done. |
| W9 | **A plan produces Todos; it is never made of them.** Where a run needs a person to go and *do* something, a `human` Task raises real work here — that is the only direction the two concepts meet ([13.8 RP30a](../platform/features/runtime.md)). |
| W10 | There is **one kind of schedule**: it names a Flow and opens a run ([SC6](../operate/features/schedules.md)). Whether a firing creates work a person accepts is a property of the plan it names, not of the schedule — which is why a nightly load raises no Todo nobody owns. |
| W15 | **Per-project access is one filter.** `ProjectManager.hidden_ids` names the private projects a reader is not on, and every read of projects, todos, plans, decisions and search applies it ([9.7](features/private-projects.md)). |
| W16 | **A simulation is a run with a project handle.** The simulator plugin computes, the runtime runs it, and `project_simulations` only records which branch asked, with which spec, inputs and seed; the result is read off the run ([9.8](features/simulation.md)). |

## 7. Deliberately absent


| Not built | Because |
|---|---|
| A `status` column on a Todo | a definition has no progress; a run does |
