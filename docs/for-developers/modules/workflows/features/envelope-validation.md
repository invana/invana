# Check a plan against the bound

Every plan is checked against the running agent's bounds **before** dispatch. A plan outside them costs
nothing and is refused with the bound named.

| | |
|---|---|
| Index | [7.3](../../../README.md#7--workflows) · Slice **S9d** |
| Module | [Workflows](../spec.md) |
| API / CLI / Studio | 🟡 / — / 🔵 |
| Related | [envelope-and-budget](../../agents/features/envelope-and-budget.md) (where bounds are authored) · [plan-selection](plan-selection.md) |

Product spec: [AG-F06 · Plans and functions](../../../../../specs/capabilities/agents/features/AG-F06-plans-and-functions/feature.md) — AG-18; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Engine

| Thing | Shape |
|---|---|
| Validation | pure function of plan × envelope; no side effects, no partial dispatch |
| Cost projection | per step kind, from recorded history |
| Refusal record | on the run: which check, which bound, what was proposed |
| Events | `plan.refused` with the bound |
