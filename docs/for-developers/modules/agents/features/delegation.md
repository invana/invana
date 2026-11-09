# Delegation

An agent may spawn an agent and hand it work — bounded by depth, fan-out, and a budget that is a
subset of its own. The child's run nests inside the parent's.

> ⚠ **Rewritten for orchestration § 0** — `Todo` · `Flow` ·
> `Task` · `TaskRun` · `Lens`. The words *Thought*, *Thinking* and *Step-as-a-record* are retired, and
> **`Task` now names a node inside a plan**, never a thing a user authored. Migration:
> task-model-migration.md.

| | |
|---|---|
| Index | [5.4](../../../README.md#5--agents) · Slice **S12d** |
| Module | [Agents](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [envelope-and-budget](envelope-and-budget.md) · [lineage](lineage.md) · [lifecycle](lifecycle.md) |

Product spec: [AG-F05 · Delegation and outside agents](../../../../../specs/capabilities/agents/features/AG-F05-delegation-and-outside-agents/feature.md) — AG-24; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Engine

| Thing | Shape |
|---|---|
| Steps | `spawn_agent · delegate · await_delegations`, all envelope-gated |
| Child agent | `parent_agent_id` · `spawned_in_run_id` · `lifetime = ephemeral` |
| Escrow | `task_runs.escrow_tokens` · `escrow_returned` on the child run |
| Ceilings | `agents.budget` keys `max_depth` · `max_children` · `max_descendants` · `max_live` |
| Exit | `task_runs.exit_reason` |
| May delegate to | `agents.policy.may_delegate` — `{agent_id: always · ask · never}` |
| Nesting | `parent_run_id` on the child's run |
| Events | `agent.spawned · delegated · delegation_returned · retired` |

## Decisions

Engine rows; the product decisions are AG-F05's.

| # | Decision |
|---|---|
| DG9 | **A child run inherits its parent run's frozen lens**, and that is how *LLM ⊆ its parent's* ([DG7](#decisions)) holds: an agent binds neither a provider nor a world, so what the parent thinks with is what its run's lens casts, and the child opens inside that same effective lens, narrowed by its own agent's guardrail if it has one ([AG25](author-an-agent.md#decisions)). A child can never be wider than the run that spawned it, in any dimension. |
| DG11 | **May spawn is `spawn_agent` in the envelope, and nothing else.** There is no `can_spawn` policy beside it — two switches for one permission is how an agent ends up allowed the step and refused the act. A spawned child is ephemeral unless the parent's pin on `spawn_agent` allows `lifetime: persistent`; with no pin, persistent is refused naming the pin. A child's own envelope drops `spawn_agent` unless the spawn names it and the parent holds it. |
| DG10 | **`can_rebind_llm` is retired.** It named a column that no longer exists. Giving a child a different model is giving it a different lens, which is the same act as every other narrowing and goes through the child's own guardrail ([AG26](author-an-agent.md#decisions)) — one mechanism, and one place a reviewer reads to learn what a child may think with. |
