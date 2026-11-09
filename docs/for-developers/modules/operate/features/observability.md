# Observability

What is slow, what it costs, what fails and where. Derived from the record — so the numbers cannot
disagree with the traces they summarise.

| | |
|---|---|
| Index | [10.3](../../../README.md#10--operate) · Slice **S11** |
| Module | [Operate](../spec.md) |
| API / CLI / Studio | 🔵 / — / 🔵 |
| Related | [audit-and-activity](audit-and-activity.md) · evidence · [envelope-and-budget](../../agents/features/envelope-and-budget.md) |

Product spec: [AG-F03 · Runs and how the agents are doing](../../../../../specs/capabilities/agents/features/AG-F03-runs-and-how-the-agents-are-doing/feature.md) — AG-28; the story, its criteria, journey, states and product decisions live there. This file keeps the engine shape and what is not settled.

## Capabilities

Not placed: latency by step kind is not specified, and spend contradicts *tokens, never currency*.

| # | Capability | Notes |
|---|---|---|
| C1 | Query latency | Per Graph, per model, per step kind |
| C2 | LLM cost | Tokens and spend, per agent, per project, per day |

## Engine

| Thing | Shape |
|---|---|
| Source | `task_runs` timings and tokens; query executions; failure outcomes |
| Derivation | on read, windowed and cached briefly; no separate pipeline |
| Routes | `GET …/metrics/{latency,cost,failures,budgets}` |

## Decisions

| # | Decision |
|---|---|
| OB1 | Metrics are derived from the record. There is no second pipeline. |
| OB4 | Spend is shown only where pricing is known; otherwise tokens alone. |
| OB6 | A run's figures open its trace: `task_runs.trace_id` is the join between the record and [telemetry](../../platform/features/telemetry.md) (TE13). The record answers *what it cost*; the trace answers *where the time went*. |
