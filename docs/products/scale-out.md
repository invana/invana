# Scale-out: orchestration and workers (proposal)

**Status: proposal, under review.** How a run spreads across machines: runs are records, orchestrators lease and
decide, every step is an envelope on a queue, and pools of workers grow with the queue. Prototype: the
*Invana — IAM and Scale-out* canvas, pages *Agents › Orchestration*, *Agents › Scaling*, *Projects › Agents pick up
todos*. Builds on [agent-fabric.md](agent-fabric.md) and
[distributed-execution](../for-developers/modules/platform/features/distributed-execution.md).

## User stories

| ID | As a | I want | So that | Boards |
|---|---|---|---|---|
| SO-01 | operator | one board from trigger to admission, runs, orchestrators, queues and pools | I see where work is and why it waits | `agents.board.orchestration` · `.closed` · `.run_parked` |
| SO-02 | operator | queues by label and class, the order workers take them, this Graph's share | a swarm never delays a question | `agents.board.orchestration.queues` |
| SO-03 | operator | orchestrator replicas and their leases; a lost one's runs move on | a crash costs seconds, not runs | `agents.board.orchestration.orchestrators` |
| SO-04 | operator | every start admitted, waiting or refused, with the policy that decided | admission is explainable | `agents.board.orchestration.admission` |
| SO-05 | operator | how many workers each pool needs, applied by KEDA or Auto Scaling | scale follows demand without Invana holding cloud keys | `agents.board.pools.desired` |
| SO-06 | operator | each LLM's tokens-a-minute limit, what waits on it, each Graph's part | I don't add workers that would only wait | `agents.board.llm_limits` |
| SO-07 | builder | a run held by a quota to say which policy, how full, what is ahead, and offer an ask | waiting is never a mystery | `agents.board.quota.waiting` |
| SO-08 | project owner | agents to pick up todos — manual, ask or auto — narrowed per agent | agents work without being started by hand | `projects.settings.pickup` · `projects.todos.claims` · `projects.todo.ask_start` |

## Decisions

| Decision | Detail |
|---|---|
| Runs are durable | A run's state lives in the database; every step hands over through its outputs, never through in-process `RunVars` (retires DE8) |
| Every step is an envelope | LLM thinking, planning, spawn, delegate and tool calls all go through the queue. The orchestrator decides; it never executes |
| Orchestrators lease runs | Stateless replicas, the same binary (`invana start --role orchestrator`). A lease is renewed every 5 s and lasts 15 s; a lost replica's runs are taken from their last saved step. Woken by `LISTEN/NOTIFY` |
| Parked runs hold nothing | Waiting on a person, an approval, a quota slot or an LLM limit: no worker, no lease |
| Spawning is a record | `work.spawn_agent` checks the quota, writes the agent-run row, escrows tokens and queues its first step. It never starts a machine |
| Queues | procrastinate on the engine's Postgres (DE1). One queue per resource label × class |
| Classes | **interactive** (someone waits on the answer) › **project** (a picked-up todo) › **batch** (schedules, sweeps, runs past 20 agents). Workers take them in that order |
| Fair share | Busy Graphs share install slots equally; an idle Graph's share is lent |
| Pools | Install infrastructure, labelled (`cpu · llm · egress · gpu · code`). A policy grants a Graph or agent the pools it may use and its worker-seconds |
| Desired workers | The engine computes ready steps ÷ steps a worker runs at once, clamped to the pool's min and max and to Graph worker-second quotas. **KEDA** (Kubernetes) and **Auto Scaling desired capacity** (EC2) apply it. Docker and local pools are fixed. Invana holds no cloud credentials |
| Scale down | A worker idle 5 min is drained, then stopped |
| LLM limits | A token bucket per model, shared by Graphs. Steps waiting on it are parked and not counted toward desired workers |
| Agents ask for capacity, not machines | A higher quota or pool max, for a run, N days or always, approved by the policy's owner |
| Admission | who (policies) → within (boundary, world, token) → quota → preflight past 20 agents. Waiting is not refusal |
| Deployment | laptop: one process, inline · compose: API, orchestrator, N workers · Kubernetes: API and orchestrator replicas, pools scaled by KEDA, one-shot runtimes as Jobs |
| Todo pick-up | Per project: **manual** · **ask** (default) · **auto**; an agent can be narrower, never wider. A claim is a 30-minute lease; one claim per todo; a lapsed claim returns the todo to the pool |

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

## Not building

| Not building | Because |
|---|---|
| Agents starting machines or pools | an idle worker per agent wastes capacity; provisioning is slow and risky |
| Pinning an agent or run to a worker | most of an agent's time is waiting; any worker can run any step |
| Invana calling cloud APIs to provision | KEDA and Auto Scaling already do it, with the platform's credentials |
| Sticky workers for cache locality | an optimisation for later |
