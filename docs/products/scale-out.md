# Scale-out: orchestration and workers (proposal)

**Status: proposal, under review.** How a run spreads across machines: runs are records, orchestrators lease and
decide, every step is an envelope on a queue, and pools of workers grow with the queue. Prototype: the
*Invana — IAM and Scale-out* canvas, pages *Agents › Orchestration*, *Agents › Scaling*, *Projects › Agents pick up
todos*. Builds on [agent-fabric.md](agent-fabric.md) and
[runtime](../../specs/system-design/runtime.md).

## User stories

SO-01–SO-07 are ST-17–ST-23 in [ST-F06 · Workers and limits](../../specs/foundation/settings/features/ST-F06-workers-and-limits/feature.md). SO-08 is PJ-15 in [PJ-F01 · Projects and tasks](../../specs/products/projects/features/PJ-F01-projects-and-tasks/feature.md), with the pick-up rules.

## Decisions

| Decision | Detail |
|---|---|
| Runs are durable | A run's state lives in the database; every step hands over through its outputs, never through in-process `RunVars` (retires DE8) |
| Every step is an envelope | LLM thinking, planning, spawn, delegate and tool calls all go through the queue. The orchestrator decides; it never executes |
| Orchestrators lease runs | Stateless replicas, the same binary (`invana start --role orchestrator`). A lease is renewed every 5 s and lasts 15 s; a lost replica's runs are taken from their last saved step. Woken by `LISTEN/NOTIFY` |
| Spawning is a record | `work.spawn_agent` checks the quota, writes the agent-run row, escrows tokens and queues its first step. It never starts a machine |
| Queues | procrastinate on the engine's Postgres (DE1). One queue per resource label × class |
| Pools | Install infrastructure, labelled (`cpu · llm · egress · gpu · code`). A policy grants a Graph or agent the pools it may use and its worker-seconds |
| Desired workers | The engine computes ready steps ÷ steps a worker runs at once, clamped to the pool's min and max and to Graph worker-second quotas. **KEDA** (Kubernetes) and **Auto Scaling desired capacity** (EC2) apply it. Docker and local pools are fixed. Invana holds no cloud credentials |
| Scale down | A worker idle 5 min is drained, then stopped |
| Deployment | laptop: one process, inline · compose: API, orchestrator, N workers · Kubernetes: API and orchestrator replicas, pools scaled by KEDA, one-shot runtimes as Jobs |

## Build order

| Phase | Delivers |
|---|---|
| 1 | Durable run state — every core step hands over through outputs |
| 2 | Leased orchestrators, every step an envelope, parking |
| 3 | Labels and pools, the three classes, fair share |
| 4 | The LLM limiter |
| 5 | Desired workers, KEDA and Auto Scaling adapters, drain |
| 6 | Quotas from IAM policies ([iam.md](iam.md)) |
| 7 | Todo pick-up modes and claims |
