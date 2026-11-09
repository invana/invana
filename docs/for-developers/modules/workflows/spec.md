# Workflows — module spec

| | |
|---|---|
| Index | [§7 · Workflows](../../README.md#7--workflows) |
| Features | [the-library](features/the-library.md) · [plan-selection](features/plan-selection.md) · [envelope-validation](features/envelope-validation.md) · [promote-a-plan](features/promote-a-plan.md) · [run-a-workflow](features/run-a-workflow.md) · [the-catalogue](features/the-catalogue.md) |
| Depends on | [Agents](../agents/spec.md) (the envelope a plan is checked against) · [Ask](../ask/spec.md) (the step catalogue and the runtime) |
| Depended on by | [Ask](../ask/spec.md) (the `plan_queries` Task) · [Work](../work/spec.md) (a Todo runs a plan) · [Operate](../operate/features/schedules.md) (a schedule is a start on a cron) · [Bring data in](../bring-data-in/features/load-a-bundle.md) (a bundle load is one of these plans) |

System design: [workflows.md](../../../../specs/system-design/modules/workflows.md) — where a plan comes from, the flow tables, the product's own plans, what the library reads, validation against the envelope. This file keeps the vocabulary, the open question on plan versions, the decisions and what it does not build.

## 1. Vocabulary

Product-wide words: [terminology.md](../../terminology.md). What this module adds:

| Noun | Is | Is not |
|---|---|---|
| **Flow** | the record: `flows` + its `tasks` rows; `reusable = true` puts it in the library | a second record per origin |
| **Template** | a reusable flow, selected by intent | a default |
| **Plan** | the flow this run executes — frozen onto it as `plan_snapshot` | a record of its own |
| **Candidate** | a `generated` flow a `plan.verify` Task judged as serving | a template |
| **Function** | one task type, `namespace.verb`, named by a Task's `step_key` | a step — a step is the Task that calls it |
| **Catalogue** | the closed set of functions a flow may name, grouped by bound | a plugin registry |

**The plan's grammar is orchestration § 5's, and this
module does not restate it.** A plan is a set of `Task` rows with declared `depends_on` edges, carrying
`when`, `map_over`, `loop`, `ref`, `approval`, `timeout_s` and `retry`. Branching and repetition are part of it: a
conditional stage is a `when`, an unhappy path is an `depends_on: [{step: x, on: failure}]`, and a cycle is
bounded on a node or in a signal, never on an edge. What this module owns is where a plan *comes
from* — the library, the selection, the validation and the promotion.

## 3. What this module owns

Open — AG-F06 reads versions, their diff and retiring one; the stand below is for Ravi to settle.

**There are no plan versions.** A run freezes `plan_snapshot`, so editing a reusable plan reaches
every future run while past runs replay unchanged — which is exactly what a version table was for.
Builtins are the one exception to editing ([workflows.md](../../../../specs/system-design/modules/workflows.md#the-products-own-plans)).

## 6. Cross-feature decisions

Engine rows, and rows that stay until they are settled; the product decisions are [Agents](../../../../specs/capabilities/agents/product.md) › Decisions and [AG-F06 · Plans and functions](../../../../specs/capabilities/agents/features/AG-F06-plans-and-functions/feature.md).

| # | Decision |
|---|---|
| F3 | **There are no plan versions.** A run freezes `plan_snapshot`; editing a reusable plan reaches future runs and never rewrites past ones. |
| F6 | Workflows are Graph-scoped. Portability is a later question. |
| F7 | A workflow is **not** a kind. Running one produces a TaskRun whose `kind` is the plan's subject, recorded as `plan_origin = reused:<id>`. It appears in [Runs](../operate/features/see-what-ran.md) as one run, not as a category of its own. |
| F14 | **A `Flow` is one record, whatever drew it.** A plan drawn from a skill, generated for a Todo, packaged or promoted is the same table with a different `origin`. There is no `SkillPlan`: provenance is a column, not a type (orchestration § 0.8). |
| F19 | **The record is `Flow`, in every layer.** Table `flows`, column `flow_id` on `tasks` and `task_runs`, routes `/flows`, schemas `FlowRead`/`FlowPage`, Studio's `Flow` type and `useFlowQuery`. *Workflow* names no record, column or route; a reusable flow is `reusable = true`. The screen calls a listed flow a **plan** (*Packaged plans*, *Generated plans*, *Promote a plan*) and its drawing **Flow** — the words of the Functions boards. `plan_snapshot`, `plan_revision`, `plan_origin` and `skill_versions.plan_id` keep *plan*: each names the plan of one run or one version, not the record. |
| F20 | **A Task's `key` is a plain identifier; its `step_key` is a function.** `${steps.<key>.<output>}` binds against the key, so a key never carries a dot. A step's key defaults to its function with dots as underscores — `nl-single@2` is `nl_translate → graph_read_validate → graph_read_query → answer_shape → plan_verify` — and a flow that calls one function twice names each (`translate_a`, `translate_b`). One rule both ways, so renaming a function renames its default keys without two steps colliding. |
| F21 | **Packaged flow keys keep their names** (`nl-single`, `model-import`, `stitch-apply`, …). They are versioned rows (`key@n`) runs and skills cite; the function rename does not reach them. |

## 7. Deliberately absent

| Not built | Because |
|---|---|
| Cross-Graph workflow sharing | the Graph is the reasoning boundary |
