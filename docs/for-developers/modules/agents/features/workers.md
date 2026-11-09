# Workers and pools

Agents are records; **workers** run their steps. A worker belongs to one **pool** — a labelled set of
Docker hosts, Python machines or a Kubernetes Deployment — and any worker in a pool whose labels cover
a step's resources may run it. A person adds workers with one command and scales every pool by hand;
the engine says where steps wait and how many workers would clear them.

| | |
|---|---|
| Index | [5.15](../../../README.md#5--agents) · Slice **F06** |
| Module | [Agents](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / 🔵 |
| Related | [distributed-execution](../../platform/features/distributed-execution.md) 13.11 (the envelope, the executor) · [tool-plugins](../../platform/features/tool-plugins.md) 13.12 (`invana worker` today) · [concurrency-and-contention](concurrency-and-contention.md) 5.7 (a Graph's slot pools — a different thing) · [tokens](../../identity-and-access/features/tokens.md) · options: [workers-and-orchestration](../../../building-engine/workers-and-orchestration.md) · products: [agent-fabric.md](../../../../products/agent-fabric.md) › Workers, AF-10 · AF-11 · [scale-out.md](../../../../products/scale-out.md) |

Product spec: [ST-F06 · Workers and limits](../../../../../specs/foundation/settings/features/ST-F06-workers-and-limits/feature.md) — ST-24 · ST-25; the stories, their criteria, journey, states and product rules live there. This file keeps the engine shape and the rows not moved.

## Surfaces

| Board | Route | Draws |
|---|---|---|
| `fleet.pools` | `/agents/workers` (tab `pools`) | C1 · C2 |
| `fleet.pool` | `/agents/workers?page=worker_pool:<pool name>` | C3 |
| `fleet.worker` | `/agents/workers?page=worker:<worker name>` | C4 |
| `fleet.capacity` | `/agents/workers` (tab `capacity`) | C5 |
| `fleet.tokens` | `/agents/workers` (tab `tokens`) | C6 |
| `fleet.add` · `.pool` · `.token` · `.run.docker` · `.run.python` · `.run.k8s` · `.waiting` · `.joined` | `/agents/workers?add=<step>` | C7 · C8 |

The *Workers* tab of the Workers page lists every worker across pools (C3's table without a pool filter).

## Engine

The queue is procrastinate behind the engine's worker gateway — [13.11](../../platform/features/distributed-execution.md)
DE9 · DE10; the options are compared in [workers-and-orchestration](../../../building-engine/workers-and-orchestration.md).

| Record | Columns |
|---|---|
| `worker_pools` | id · name (unique, install-wide) · runs_on (`docker · python · kubernetes`) · labels[] · slots_per_worker · plugins[] · secrets[] (names) · egress[] (domains) · set_by (`hand · replicas`) · replicas · created_by_id · created_at |
| `workers` | id · pool_id · name · node · version · labels[] · plugins[] · slots · state (`starting · busy · idle · draining · lost · stopped`) · credential hash · credential_rotated_at · joined_via (token id) · joined_at · last_heartbeat_at · from_ip |
| `worker_events` | id · pool_id · worker_id? · change (`joined · lost · drained · stopped · replicas`) · why · actor_id? · at |
| `worker_stats` | pool_id · at (30 s buckets) · workers · slots · slots_busy · ready · oldest_s · envelopes · suggested — written by the engine; every number C2 · C5 show |
| Join token | an IAM token (11.x tokens) of a service account, narrowed to joining one pool; `cap` and `expires_at` on the token row |

| Route | Does |
|---|---|
| `GET /api/v1/workers/pools` · `POST` · `GET/PATCH …/pools/{id}` | pools with their stored numbers (list contract) |
| `GET /api/v1/workers` · `GET …/workers/{id}` · `POST …/workers/{id}/drain` | workers, one worker, drain |
| `GET /api/v1/workers/capacity` · `GET /api/v1/workers/events` | C5 · events |
| `POST /api/v1/workers/join-tokens` · `GET` · `DELETE …/{id}` | mint (secret once) · list · revoke |
| `POST /api/v1/workers/join` | join token → worker credential |
| `POST /api/v1/workers/heartbeat` · `POST …/lease` · `POST …/outcome` | the worker's dial-out loop |

| CLI | Does |
|---|---|
| `invana worker --engine <url> --token <join> --pool <name> [--labels …] [--slots N]` | joins and runs; env `INVANA_ENGINE_URL · INVANA_JOIN_TOKEN · INVANA_POOL · INVANA_LABELS · INVANA_SLOTS` |
| `invana worker install-service` | a systemd / launchd unit for the same command |

## Decisions

| # | Decision |
|---|---|
| WK32 | **Pools and workers are Fleet, a platform product.** No Graph picker; Settings › Graph limits says which pools each Graph may use ([5.16](install-wide-agents-and-skills.md) WD16) |
| WK2 | **A join token is an IAM token owned by a service account, narrowed to joining one pool.** It is minted, listed and revoked from Workers › Join tokens and shows in IAM › Tokens. The worker it admits is not a principal: it receives its own pool credential, rotated hourly, and runs steps under the agent's access, never its own |
| WK8 | **In F06 tool steps run in workers;** the NL chain and planning stay in the engine until their steps hand over through outputs (scale-out phase 1) |
| WK11 | **A join token is a `personal_access_tokens` row with the `invana_join_` prefix,** held by the install's `workers` service account (made on the first mint, a member of no Graph) and carrying `worker_pool_id` · `join_cap` · `joins`. The auth edge refuses it on every route but `POST /api/v1/workers/join`. Join tokens are install-wide, so they list on Workers › Join tokens and not on a Graph's IAM › Tokens |
| WK12 | **The queue is named for the step's resources:** a tool step defers onto `tools.<labels>` (its function's `resources`, sorted, joined by `+` — `tools.cpu`, `tools.cpu+egress`). A lease takes the next job from every queue the pool's labels cover. Each joined worker is a procrastinate worker row; the gateway fetches, heartbeats and finishes jobs under its id, so procrastinate's stalled-job query finds a lost worker's jobs |
| WK13 | **A worker credential is an `invana_wkr_` secret,** stored as its sha256 on the worker row; a heartbeat an hour after the last rotation returns a new one, and the previous one is honoured until the next rotation |
| WK14 | **The gateway sweep runs in the engine** under `INVANA_EXECUTOR=procrastinate` on Postgres: every 5 s it marks workers silent 30 s `lost`, redelivers their jobs and writes the event; every 30 s it writes one `worker_stats` row a pool |
| WK15 | **A remote step's context is its args, its step id, its idempotency key, the secrets its plugin declares (from the worker's environment) and the artifacts it records** — no database session, no graph connection. Tool steps need nothing more; the artifacts ride back with the outcome |
| WK16 | **A lease long-polls for up to 20 s** and answers `204` when nothing is ready; heartbeats carry the worker's busy slots and CPU, which C3 · C4 show |
| WK17 | **Workers is an Agents rail section** (`/agents/workers`, tabs Pools · Workers · Capacity · Join tokens). A pool and a worker open as workbook tabs (`worker_pool:<name>` · `worker:<name>`), each with the breadcrumb *Workers › pool › worker*; pool names and worker names are unique install-wide, and the routes take an id or a name. Add workers is a modal whose step is `?add=` |
| WK18 | **A worker's outcome row carries who ran it.** The gateway stores the outcome in `envelope_outcomes` with `_worker` (id, pool, duration) and `_artifacts` beside the tagged JSON; a worker's steps an hour, failures and p95 and a pool's envelopes are read from those keys, and `outcome_from_json` ignores keys that start with `_` |
| WK19 | **A worker's log lines and CPU series live in the engine process's memory** — the last ~200 lines and 30 minutes, fed by heartbeats. They are lost on restart and empty on a detail read served by another engine process; storing them is scale-out work |
| WK20 | **A refused join makes no worker row,** so *Joined* shows its checks *waiting* until a worker joins; the refusal reaches the worker as the reason (labels outside the pool, plugins missing, token expired or used up) |
| WK21 | **A lost worker that heartbeats again is revived** with a new queue worker id; a draining worker that reports no busy slots is `stopped` and its credential is refused from then on |
| WK22 | **Add workers opens on Docker** for *Where*; `?pool=<name>` preselects the pool, so Capacity's per-pool *Add workers* and a pool page's Join tokens open the modal on that pool. Closing drops `add` · `where` · `pool` from the URL |
| WK23 | **Kubernetes' Run it is three `kubectl` lines** (secret · apply · rollout); *Download as a file* saves the Deployment manifest. Docker's command runs with `--restart unless-stopped` and carries the labels and slots |
| WK24 | **Joined watches the token minted in the modal;** opened without one, it watches the pool's newest unrevoked join token a worker joined with (else its newest unrevoked one), and lists that token's newest workers |
| WK25 | **Capacity's chart is one pool's last 10 minutes** — the first pool short of workers, else the first pool — as stored `worker_stats` points (ready · workers); replica changes and joins are marked with the event's *why* |
| WK26 | **A pool's *Runs on* line is the engine's:** Kubernetes reads *invana/worker deployment* (*Set by* carries the replicas), Docker counts distinct live hosts, Python names the machines. Studio derives no slot or host number — the pool's totals are served |
| WK27 | **A pool page has tabs Workers · Capacity · Join tokens,** each the Workers page's surface filtered to that pool |
| WK28 | **A pool's *workers* count is its live workers** (busy · idle · draining); a joined worker that has not heartbeat yet counts only in *starting*, so a pool with only a starting worker reads *0 · no workers*. The pool head reads *N workers · K starting · L lost* when those are non-zero, matching its state chips |
| WK29 | **Ages read for a person:** a heartbeat's age is `42 s` · `3 min` · `2 h`, the same as every other served span on the Workers pages |
| WK31 | **Run it starts the engine's own image,** `invana/worker:<engine version>`, served with the minted token as `worker_image`; the Python note names the engine's Python (3.14) |
