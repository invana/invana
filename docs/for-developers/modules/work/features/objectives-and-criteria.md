# Objectives and criteria

Goals and "done" as **nodes**, not paragraphs — so an agent can cite one, a check can prove one, and a
reviewer sees which one failed.

| | |
|---|---|
| Index | [9.2](../../../README.md#9--work) · Slice **S12b** |
| Module | [Work](../spec.md) |
| API / CLI / Studio | 🔵 / — / 🔵 |
| Depends on | [projects-and-tasks](projects-and-tasks.md) · [rules](../../skills/features/rules.md) |

Product spec: [PJ-F02 · Objectives and review](../../../../../specs/capabilities/projects/features/PJ-F02-objectives-and-review/feature.md) — PJ-16; the story, its criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Engine

| Thing | Shape |
|---|---|
| `rules` | `scope (graph\|project)` · `owner_id` · `statement` · `kind` · `active` · `order` |
| `objectives` | `project_id` · `statement` · `status (open\|met\|dropped)` · `order` |
| `criteria` | `scope (project\|Todo)` · `owner_id` · `objective_id?` · `statement` · `check` · `check_spec` · `revision` |
| `criterion_outcomes` | `criterion_id` · `criterion_revision` · **`statement_at_check`** · `todo_id` · `state` · `evidence` · `checked_by_*` |
| Routes | `…/rules*` · `…/projects/{key}/{objectives,criteria,rules}` · `…/todos/{id}/{criteria,outcomes}` |
| Events | `rule.*` · `objective.*` · `criterion.*` · `criterion.evaluated` |
| Migration | Old prose lands as one node, `check = human`, `needs_split = true` — nothing dropped |

## Decisions

Engine rows; the product decisions are PJ-F02's.

| # | Decision |
|---|---|
| D1 | The `graphs.objectives` and `graphs.success_criteria` columns that predate this are dropped in migration `000000000036`, along with the two fields the settings form offered for them. `graphs.instructions` is not one of these: it is standing guidance the runtime hands to the LLM, and it lives on the Agents tab of the settings panel. |
| D10 | A criterion carries a `revision`, not a version chain; the outcome snapshots the statement it judged (`statement_at_check`). |

## Constraints this puts on the engine

| Constraint | Where it bites |
|---|---|
| The context assembler offers rules as **discrete items with ids** | a run can cite the rule it applied; a concatenated blob cannot |
| `accept` carries per-criterion outcomes | plan verification gets a specific signal, not a binary one |

## Open

| # | Question |
|---|---|
| Q3 | Do rules need priority, or is `order` enough? |
