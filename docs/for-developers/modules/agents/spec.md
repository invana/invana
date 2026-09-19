# Agents — module spec

What an agent is and what bounds it. An agent is the principal that runs work: it carries a provider
and model, binds [skills](../skills/spec.md), runs [workflows](../workflows/spec.md), and is held
inside an envelope. Those three are authored separately and reused separately — this spec owns the
agent and the bounds; **the composition happens at run time and is drawn in [Ask](../ask/spec.md)**.

> ⚠ **Rewritten for [orchestration § 0](../../orchestration.md#0-the-records)** — `Todo` · `TaskPlan` ·
> `Task` · `TaskRun` · `Lens`. The words *Thought*, *Thinking* and *Step-as-a-record* are retired, and
> **`Task` now names a node inside a plan**, never a thing a user authored. Migration:
> [task-model-migration.md](../../building-engine/task-model-migration.md).

| | |
|---|---|
| Index | [§5 · Agents](../../README.md#5--agents) |
| Features | [providers-and-models](features/providers-and-models.md) · [the-roster](features/the-roster.md) · [envelope-and-budget](features/envelope-and-budget.md) · [delegation](features/delegation.md) · [lifecycle](features/lifecycle.md) · [lineage](features/lineage.md) · [concurrency-and-contention](features/concurrency-and-contention.md) |
| Depends on | [Skills](../skills/spec.md) (what it may be offered) · [Workflows](../workflows/spec.md) (what it may run) · Ask (an agent runs a run) |
| Depended on by | [Work](../work/spec.md) (an agent is an assignee) · Ask (a session asks through an agent) |

## 1. Vocabulary

Product-wide words: [terminology.md](../../terminology.md). What this module adds:

| Noun | Is | Is not |
|---|---|---|
| **Agent** | a principal that can be assigned work, carrying provider, model, bindings, envelope and budget | a prompt, or a persona |
| **Provider** | a configured LLM endpoint on the Graph, which an agent binds | the model name |
| **Envelope** | the static bounds: which steps, which pinned arguments, which ceilings | a runtime check |
| **Budget** | the cost ceiling a run may spend. **At the ceiling a run pauses and asks** — it does not fail ([orchestration § 0.10](../../orchestration.md#010-budget--the-ceiling-that-pauses-instead-of-failing)) | a quota · a hard stop |
| **Lifetime** | `persistent` or `ephemeral` — whether the agent outlives the work it was spawned for | status |
| **Lineage** | who authored whom, who spawned whom, on what run | an org chart |

## 2. Where the agent sits

An agent is authored here; what it may be offered is [Skills](../skills/spec.md), what it may run is
[Workflows](../workflows/spec.md), and how the three come together at run time is drawn in
[Ask § 3](../ask/spec.md). This spec owns the agent and its bounds — nothing else.

| This module answers | Answered elsewhere |
|---|---|
| What does this agent carry? | What is a skill? → Skills |
| What may it run, at what cost? | Which plan runs? → Workflows |
| Who spawned it, and what happens when it retires? | What did it produce? → Ask |
| How many may run at once, and what gives when they contend? | When does a job run? → the runtime adapter |

This module is where the orchestration lives: [Work](../work/spec.md) says what needs doing, and the
agent an assignment names is what turns it into a run.

**Bounds nest.** An envelope bounds what one agent may run; a **lens** bounds what it may see; a budget bounds what it may spend;
delegation bounds depth and fan-out; and a Graph ceiling bounds how many run at once. Each is stated,
each refuses with the bound named, and none of them is negotiable at run time.

## 3. What this module owns

| Owns | Shape |
|---|---|
| `agents` | `graph_id` · `name` · `description` · `kind` · `status` · `lifetime` · `parent_agent_id?` · `spawned_in_run_id?` · `instructions` · `budget` · `policy` |
| `agent_skills` | the bindings this agent carries — authored in [Skills](../skills/spec.md) |
| Envelope · budget | on the agent: allowed step keys, pinned arguments, cost and depth ceilings |
| Lineage | `parent_agent_id` + `spawned_in_run_id` — retirement keeps the row so lineage resolves |

## 4. Flows

### F1 — Author an agent

```mermaid
flowchart LR
    A[New agent] --> B[Pick a template<br/>envelope comes with it]
    B --> C[Bind provider + model]
    C --> D[Offer skills<br/>from the Graph's set]
    D --> E[Set budget and policy]
    E --> F[Active · appears in assignee pickers]
```

Seams: no provider configured → the form says which, and links to it · a skill bound then deleted →
the binding drops and the agent keeps working · no default agent on the Graph → the first authored
agent is offered as one.

### F2 — Delegate, bounded

```mermaid
flowchart TD
    A[Agent mid-run] --> S[spawn_agent]
    S --> B{Within depth ·<br/>fan-out · budget ⊆ parent?}
    B -->|no| REF[Refused, naming the bound]
    B -->|yes| C[Child agent · ephemeral by default]
    C --> D[delegate · await_delegations]
    D --> E[Child run nests on the card]
    E --> F[Verdict returns as an emission]
    F --> G[Child retires when the work closes]
```

Cancelling the parent cascades. A retired agent keeps its row.

## 5. Surfaces

| Surface | Shape |
|---|---|
| Roster | one list; `+ New agent` in the header; a row's actions on the row |
| Agent panel | sections stacked — Brief · Envelope · Recent plans; actions in the content |
| Lineage | a canvas: who authored whom, who spawned whom, on what run |

## 6. Cross-feature decisions

| # | Decision |
|---|---|
| A1 | An agent carries the LLM provider and model. The composer never picks one. |
| A2 | Every agent has an envelope. There is no unbounded agent. |
| A3 | A spawned agent's budget is a subset of its parent's, and it is ephemeral by default. |
| A4 | Retire never deletes — lineage must stay resolvable. |

## 7. Deliberately absent

| Not built | Because |
|---|---|
| Agent memory across task_runs | learning goes into the graph as records an agent queries, or into skills a person edits |
| Agents accepting their own work | the acceptance seam belongs to [Work](../work/spec.md) |
| Cross-Graph agents | the Graph is the reasoning boundary |
