# Workers and orchestration — the executor options

What runs an agent's steps on machines other than the API process, and what keeps a run alive when one
of them dies. [13.11](../modules/platform/features/distributed-execution.md) chose **procrastinate** among
procrastinate, Dramatiq and Prefect for *tool steps queued from an API process to a worker that reads
the app database*. [Workers](../modules/agents/features/workers.md) (5.15) asks more of it: workers on
other machines that **dial out over HTTPS with no database access**, pools routed by label, a worker
lost after 30 s of silence, and — from [scale-out](../../products/scale-out.md) — durable runs and
orchestrators that can die. This page sets six candidates against that, and the benchmark that decides.

**Status: decided — procrastinate + an engine-run worker gateway** (13.11 DE9 · DE10); F06 builds it.

## What the choice must carry

| # | Requirement | Source |
|---|---|---|
| R1 | Self-hosted, air-gappable, each added stateful service named as an ops cost | target: enterprise on-prem |
| R2 | A worker dials out over HTTPS with a credential — no inbound port, no database credential | agent-fabric › Workers |
| R3 | Docker, Python and a Kubernetes manifest are all first-class worker targets; no cloud integration | agent-fabric › Workers |
| R4 | Pools by label: a step goes to a pool whose labels cover its function's resources; unroutable steps wait, naming the label | agent-fabric › Workers |
| R5 | A worker silent 30 s is lost; its steps are redelivered with the same idempotency key (`run_id:node_id:attempt`) | agent-fabric · DE4 |
| R6 | Fan-out: a 700-agent run, thousands of lanes, dispatched in seconds | AF-09 |
| R7 | Parked runs hold nothing — no worker, no lease — while they wait on a person, an approval or a quota | scale-out |
| R8 | The orchestrator decides (frontier, signals, budgets, ledger); workers only run envelopes | agent-fabric › Control plane, data plane |
| R9 | The engine owns the numbers Workers shows — slots, queue depth, waits, suggested workers — from stored rows | CLAUDE.md rule 13 |
| R10 | Open licence that permits an enterprise to run it on its own hardware | R1 |

## The options

| | procrastinate | Temporal | Hatchet | Restate | DBOS Transact | Argo Workflows |
|---|---|---|---|---|---|---|
| What it is | A job queue library on Postgres | A durable-execution server; workflows as deterministic code, replayed from history | A task/workflow engine on Postgres; durable tasks, DAGs | A durable-execution server; handlers journalled step by step | A library; workflows checkpointed to Postgres | A Kubernetes controller; each step a pod |
| Services it adds | **none** — the app's Postgres | server (frontend · history · matching · worker services) + its database; Elasticsearch/OpenSearch for advanced visibility | the Hatchet engine + its Postgres (RabbitMQ optional) | the Restate server (its own embedded log and state) | **none** — the app's Postgres | the Argo controller, on Kubernetes only |
| Who orchestrates | Invana's interpreter, as today | Temporal, once the interpreter becomes workflow code | Hatchet's DAG, or Invana with Hatchet as a queue | Restate, once the interpreter becomes Restate handlers | DBOS, once the interpreter's steps are `@step` functions | Argo, once a run becomes a Workflow manifest |
| Worker connects | **to Postgres** (fails R2) unless the engine fronts it | outbound gRPC to the server, mTLS or API key ✓ | outbound gRPC to the engine, API token ✓ | **the server calls the worker's HTTP endpoint** — inbound port (fails R2) | **to Postgres** (fails R2) unless the engine fronts it | kubelet starts a pod; no Docker or Python target (fails R3) |
| Routing by label | a queue per label; worker listens on its pools' queues | a task queue per label | worker labels and affinity, built in | a service per label | a queue per label | node selectors |
| Lost worker | heartbeat + the reaper the engine runs (13.4 s at a 10 s threshold, measured) | activity heartbeat timeout; retried by the server | heartbeat; reassigned by the engine | invocation retried from its journal | a dead *process*'s workflows recover on its restart; another machine's recovery needs DBOS Conductor (commercial) or our own code | pod failure → step retry |
| Orchestrator death (R7, scale-out) | Invana's: a run's frontier is already rows; a leased orchestrator is ours to build | the server holds the run; workers replay | the engine holds a DAG run; Invana's frontier would be duplicated | the server holds it | another process resumes from the checkpoint | the controller holds it |
| Parked runs | rows only ✓ | a sleeping workflow costs history, not a worker ✓ | durable sleep/event ✓ | suspended invocation ✓ | durable sleep / `recv` ✓ | a suspended step ✓ |
| Fan-out | 1 309 tasks/s on 9 workers, 1 000 sent in one insert (measured) | high, but every activity is history events; a 700-agent run needs child workflows and continue-as-new to stay under history limits | high; built for fan-out, with concurrency keys and rate limits | high | bounded by Postgres, like procrastinate | a pod per step — seconds each; thousands of pods per run is a cluster event |
| Fair share, rate limits (scale-out phases 3–4) | ours to build, from stored rows | ours to build, or task-queue rate limits | built in — concurrency groups, rate limits, priorities | ours to build | queue concurrency and rate limits, built in | parallelism limits only |
| Fits R9 (numbers from our rows) | ✓ — jobs are rows in our database | read the server's visibility API, or mirror into ours | read Hatchet's database or API, or mirror | read its admin API, or mirror | ✓ — checkpoints are rows in our database | read the Kubernetes API, or mirror |
| Rewrite of the interpreter | none | large — determinism rules on everything the interpreter does between activities | medium if a queue, large if its DAG | large — handlers and journal semantics | medium — steps become `@step`, side effects move into them | large — runs become manifests |
| Licence | MIT | MIT | MIT | **BSL 1.1** for the server (verify the current terms) | MIT (Conductor is commercial) | Apache 2.0 |

## Reading the table

| Option | Verdict | Why |
|---|---|---|
| procrastinate + an engine-run worker gateway | **Recommended** | Adds no service (R1), measured best on throughput and dispatch, already built and recovered. R2 is met by putting the engine between worker and queue: a worker long-polls `POST /api/v1/workers/lease` over HTTPS with its pool credential, the engine takes the job from procrastinate for that pool's queues, the worker heartbeats and posts the outcome back. Workers never see Postgres. Durability of the *run* is already ours (the frontier is rows); a leased orchestrator is the scale-out work it would be in any option except Temporal/Restate |
| Hatchet | Runner-up | Meets R2–R4 out of the box and brings fair share and rate limits that scale-out phases 3–4 would otherwise build. Costs a second service and its database at every customer, and a second source of truth for run state beside ours |
| Temporal | Strongest durability, highest cost | Solves orchestrator death outright, but it is the heaviest install (R1), and the interpreter's plan graph, signals and replans would be rewritten as deterministic workflow code; a 700-agent run fights history limits |
| DBOS Transact | Close on R1, fails R2 alone | No service, durable steps in our Postgres — but a worker needs the database, so it needs the same gateway as procrastinate, and cross-machine recovery is its commercial Conductor or our code. It would replace our frontier rather than our queue |
| Restate | Out | Fails R2 (it calls into workers) and R10 (BSL) |
| Argo Workflows | Out | Fails R3 (Kubernetes only) and R6 (a pod per step) |

## Benchmark plan

The harness is `engine/benchmarks/executors/` — the same `workload.py`, one adapter per option, results
in `results/<option>.json`, nothing added to the engine's dependencies. Candidates: **procrastinate +
gateway**, **Hatchet**, **Temporal**, **DBOS + gateway**. Restate and Argo are out on paper.

| # | Test | Measures | Pass |
|---|---|---|---|
| B1 | 13.11's fan-out, throughput and dispatch, unchanged | the same three numbers on 1 · 3 · 9 workers | within 15% of procrastinate's 13.11 numbers |
| B2 | Dial-out: workers in a second Docker network that reaches only the engine's HTTPS port | the option runs B1 with no database route from workers | runs; report the overhead against B1 |
| B3 | A 700-agent run: 5 000 lanes of `bench.graph_query` + 700 `bench.llm_step` | makespan on 9 and 27 workers; the orchestrator's CPU | efficiency ≥ 0.7 at 27 workers |
| B4 | Kill a worker mid-B3 (SIGKILL) | lost · duplicates · kill → redelivered | 0 · 0 · ≤ 35 s at the 30 s rule |
| B5 | Kill the orchestrator / API process mid-B3 | does the run finish after restart; duplicates | finishes, 0 duplicates |
| B6 | 10 000 parked runs, then wake 1 000 | idle cost (rows, memory, connections); wake-to-first-step p95 | no worker or connection held while parked |
| B7 | Labels: pools `cpu` and `egress`, a step needing `gpu` | routed correctly; the `gpu` step waits as unroutable | waits, naming `gpu` |
| B8 | Install footprint | services, containers, idle memory, steps for an air-gapped install | reported, not passed |

Machine and settings as 13.11 (one laptop, Postgres 18 in Docker; Hatchet and Temporal on their
documented Docker Compose with Postgres). No graph database is touched and no model is called.

## The decision

| Question | Options | Chosen |
|---|---|---|
| Which executor carries workers and, later, scale-out? | procrastinate + gateway · Hatchet · Temporal · DBOS + gateway | **procrastinate + gateway**, unless B5 or B3 shows a gap the gateway cannot close |
| Run the benchmark before building, or build on the recommendation and benchmark B2–B5 as the first F06 step? | benchmark first · build and measure | **Build and measure** — procrastinate is already in the engine and measured on B1; B2–B5 are its acceptance tests, and a failure there reopens this page |
