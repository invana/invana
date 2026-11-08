# How many run at once

How many agents may be working at once in a Graph, and what happens when they want the same things.
The outermost bound in the same family as an envelope and a budget — one level up, and per Graph.

| | |
|---|---|
| Index | [5.7](../../../README.md#5--agents) · Slice **S12e** |
| Module | [Agents](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [envelope-and-budget](envelope-and-budget.md) · [delegation](delegation.md) · [schedules](../../operate/features/schedules.md) · [runtime-and-adapters](../../ask/features/runtime-and-adapters.md) |

Product spec: [ST-F06 · Workers and limits](../../../../../specs/foundation/settings/features/ST-F06-workers-and-limits/feature.md) — ST-16; the story, its criteria, journey, states and product rules live there. This file keeps the engine shape and the rows not moved.

## Capabilities

| # | Capability | Notes |
|---|---|---|
| C7 | The database pool is a real limit | A run refused for want of a connection says that, naming the pool |

## Surfaces

| Surface | Shape |
|---|---|
| Graph settings | The ceiling and its policy, beside the connection — **and the pools beneath them**, busy or quiet, because contention has to be visible where the number that causes it is set (C8). `graphs/PoolsTable.tsx`, rendered by `ConcurrencyFields`; A5 is not a page of its own |
| The Graph's activity | Running · queued · waiting on a provider, with counts |
| A queued task | Its position and what it waits behind |

## Engine

| Thing | Shape |
|---|---|
| Ceiling | `graphs.max_concurrent_runs` + `graphs.concurrency_policy` — **both already exist** |
| Pools | `graphs.pools` JSON — `{"llm": 20, "graphdb": 50, "heavy": 4}`. New ([data model § 5.3](../../../building-engine/govern-and-agents-data-model.md)) |
| Accounting | a slot per run, including delegated children. **A lane takes a pool slot, not a step** |
| The live queue | **not stored** ([CC7](#decisions)) — `GET …/u/{username}/{graphSlug}/contention` reads the runtime process and returns what is running, what is queued, each waiter's position and why, plus every **configured** pool with its `size` and `in_use` |
| Precedence | user-triggered before schedule-triggered; otherwise first in, first served |
| Backpressure | provider rate limits and connection-pool exhaustion reported as bounds |
| Events | `run.queued · started · refused_ceiling · waiting_on_provider` |

### Every ceiling in force, in one place

| Ceiling | Default | What it protects |
|---|---|---|
| Graph · max concurrent runs | `4` | the contended thing is the deployment |
| Agent · `max_concurrent_runs` | `3` | per agent, across every run it is working |
| Pool · `llm` | `20` | a lane takes a slot, not a step |
| Pool · `graphdb` | `50` | the connection pool, named when it refuses |
| Pool · `heavy` | `4` | graph algorithms — CPU and memory bound |

**A waiting run is not a running run.** It holds no slot, draws no pool capacity and costs nothing —
so a queue is a queue, not a fleet of processes parked on a machine.

## Decisions

| # | Decision |
|---|---|
| CC7 | The queue lives in the process that owns the runtime, not in a table. A restart fails what was mid-flight and drops what was waiting — the same story in-flight runs already have, rather than a second, quieter one. |
| CC8 | **Pools are named and configured on the Graph, and a refusal names the pool.** `llm` · `graphdb` · `heavy` — three, because they are three different scarce things and a single number would have to be the smallest of them. A run refused for want of a connection says *the `graphdb` pool*, never *a query error*. |
| CC12 | **A pool slot is held across one crossing, not one run**, and taken *after* the lens has spoken. A run waiting five seconds on a model must not also hold a database connection it is not using, and a call this world refuses must not first consume a slot somebody else could have used. Given back when the crossing closes, and swept when the run settles — a crossing that raises between its two halves would leak one, and a pool that only ever shrinks is worse than no pool at all. |
| CC13 | **A configured pool is listed whether or not it is busy.** `GET …/graphs/{id}/concurrency` returns every pool the Graph configures with its size and what is in it — a pool that appeared only once it was full would make *is this Graph stalled on connections?* unanswerable in exactly the case where the answer is *no*. |
| CC8 | The ceiling is a group in the Graph's settings form, with the live counts under the fields. Contention is set and read in one place, because a number you cannot see the effect of is a number nobody tunes. |
