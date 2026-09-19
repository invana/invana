# Promote a plan

A plan the *Verify* step judged as having served becomes a candidate. A person promotes it into the
library, named by intent. That is how workflows get authored.

> ⚠ **Rewritten for [orchestration § 0](../../../orchestration.md#0-the-records)** — `Todo` · `TaskPlan` ·
> `Task` · `TaskRun` · `Lens`. The words *Thought*, *Thinking* and *Step-as-a-record* are retired, and
> **`Task` now names a node inside a plan**, never a thing a user authored. Migration:
> [task-model-migration.md](../../../building-engine/task-model-migration.md).

| | |
|---|---|
| Index | [7.4](../../../README.md#7--workflows) · Slice **S12c** |
| Module | [Workflows](../spec.md) |
| API / CLI / Studio | 🟡 / — / 🟡 |
| Related | [the-library](the-library.md) · [plan-selection](plan-selection.md) · [proposals](../../memory/features/proposals.md) |

> **As** someone who just watched a run go well, **I want** to keep that plan, **so that** the next
> identical question is answered the same way for a fraction of the cost.

## Capabilities

| # | Capability | Notes |
|---|---|---|
| C1 | Only a verified plan is a candidate | Verify judged it as serving the intent |
| C2 | A person promotes | The verdict makes it eligible; it does not publish anything |
| C3 | Named by intent | The intent is what selection will match on later |
| C4 | Editable before promotion | Trim a step, pin an argument — the edit is recorded |
| C5 | Publishes a version | v1 of a new workflow, or v(n+1) of an existing one |
| C6 | Carries its origin | The run it came from, forever |
| C7 | Repeated generation is evidence | A proposal may suggest promoting, with the runs that generated it |

## Journey

```mermaid
flowchart TD
    A[A run finishes] --> B{Verify: did it serve?}
    B -->|no| C[Recorded · not a candidate]
    B -->|yes| D[Candidate · shown on the run and in Review]
    D --> E{A person looks}
    E -->|promote| F[Name the intent · edit if needed]
    F --> G{Existing workflow with this intent?}
    G -->|yes| H[Publish v(n+1) · diff against v(n)]
    G -->|no| I[Publish v1 of a new workflow]
    H --> J[Selected by intent from the next run on]
    I --> J
    E -->|discard| K[Stays a one-off · recorded]
```

## Seams

| Seam | What the user sees |
|---|---|
| Verified but trivial | Still a candidate; the person decides it is not worth keeping |
| Two candidates for one intent | Both listed; promoting one offers to retire the other |
| Edited before promotion | The published version records that it was edited from the run's plan |
| A promoted plan that stops serving | Evidence, and a proposal to retire or revise it |

## Surfaces

| Surface | Shape |
|---|---|
| Run header | "Promote this plan" when it is a candidate |
| Review | Candidates sit with proposals — they wait, they do not block |
| Library | The new version, with its origin run linked |

## Engine

| Thing | Shape |
|---|---|
| Candidate | derived: a run whose Verify step passed and whose plan was generated |
| Promotion | publishes a `workflow_version` with `created_from_run_id` |
| Routes | `POST …/task_runs/{id}/promote` |
| Events | `plan.promoted` |

## Decisions

| # | Decision |
|---|---|
| PP1 | Only a Verify-passed plan is promotable. |
| PP2 | Promotion is a person's action; the verdict only makes it eligible. |
| PP3 | A promoted version records the run it came from. |
| PP4 | Editing before promotion is allowed and recorded. |

## Not building

| Not building | Because |
|---|---|
| Auto-promotion above a success rate | promotion is a judgement about intent, not a threshold |
| Promoting a selected (already templated) plan | it is already in the library |
| Promotion across Graphs | the Graph is the reasoning boundary |
