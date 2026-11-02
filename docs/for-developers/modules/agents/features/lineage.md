# Who spawned whom

Who authored whom, who spawned whom, and on which run. Drawn as a canvas, because the question is
structural: *where did this agent come from, and what did it do on whose behalf?*

| | |
|---|---|
| Index | [5.6](../../../README.md#5--agents) · Slice **S12c** |
| Module | [Agents](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [delegation](delegation.md) · [audit-and-activity](../../operate/features/audit-and-activity.md) |

Product spec: [AG-F05 · Delegation and outside agents](../../../../../specs/products/agents/features/AG-F05-delegation-and-outside-agents/feature.md) — AG-24; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Engine

| Thing | Shape |
|---|---|
| Edges | `parent_agent_id`, `spawned_in_run_id`, and delegation events |
| On-behalf-of | from the event record, not from the agent |
| Routes | `GET …/agents/lineage` with a window |
