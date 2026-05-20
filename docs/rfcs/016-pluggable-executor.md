# RFC-016: Pluggable Executor — Orchestration as a Boundary

**Status**: Draft
**Author**: Invana Team
**Date**: 2026-05-20

---

## Problem

Tasks and pipelines (per `docs/system-design.md` §2, §4.6) are part of Invana's vocabulary. Today, the engine has no real runtime for them — and that's fine for v1. But before we *do* build one, we need to decide what we're building.

Orchestration is a solved problem: Prefect, Temporal, Dagster, Hatchet, Celery, Arq, even cron all handle scheduling, retries, fan-out, concurrency, dead-lettering, and backfills, with mature operational tooling. If Invana grows its own scheduler, it ends up reinventing the bottom 30% of those tools — badly — while still not being able to plug into the orchestrator a user's organization has already standardised on.

But: forcing a user to set up Temporal before they can run their first PDF connector kills the "open it and go" story that the OS framing in `docs/system-design.md` §1 promises. The OSS distribution has to work with zero external infra.

The resolution proposed here: **Invana owns the data contract (Task → Dataset), not the scheduling mechanics.** A pluggable `Executor` interface separates the two. The OSS core ships with a minimal `LocalExecutor` good enough for single-user, single-host installs; production deployments swap it for an adapter to Prefect / Temporal / their own infra.

---

## Goals

1. **Define Task → Dataset as Invana's contract.** A task description is a typed, serialisable record; running it must produce a Dataset (records + system graph model) and bind it to the mission. This is owned by Invana and does not change across executors.
2. **Define an `Executor` interface** — the boundary between "Invana decides *what* to run" and "executor decides *when and how* to run it".
3. **Ship a `LocalExecutor` in core.** In-process, asyncio-based, persists task records and dataset refs to the Postgres/SQLite app DB. Zero external dependencies. Good for laptops, demos, single-tenant installs.
4. **Make adapters first-class but optional.** `invana-prefect`, `invana-temporal`, `invana-dagster` ship as separate packages in `integrations/` (same pattern as `invana-neo4j`, RFC-001).
5. **Honour mission lifecycle at the boundary.** Closing a mission (§4.10) freezes its tasks regardless of which executor is running — the executor adapter must respect this.
6. **Preserve groundedness.** Every Dataset produced under any executor must carry the same provenance chain (§5 *Groundedness & explainability*); without that, the executor adapter is non-conforming.

**Non-goals (deferred):**

- Building Prefect / Temporal / Dagster adapters in this RFC. We spec the interface and ship `LocalExecutor` only.
- Distributed `LocalExecutor` (multi-host, work-stealing). If you need that, use a real executor.
- Pipeline DSL beyond what's needed to express "run task A, then B" and "run tasks A, B, C in parallel". See *Pipelines* below.
- Backfills, time-travel, dataset versioning across runs. Tracked in `deferred-features.md`.

---

## Design

### Data contract: Task and Dataset

These remain as defined in the system design. This RFC adds nothing to the conceptual model — only formalises what's persisted and what's handed to the executor.

A **TaskSpec** is the typed, serialisable description of a task:

```python
class TaskSpec(BaseModel):
    id: UUID                          # stable identity; same spec re-run = same id
    mission_id: UUID
    connector_class: str              # e.g. "invana.connectors.pdf.PDFConnector"
    connector_config: dict[str, Any]  # validated by the connector class
    target: dict[str, Any]            # connector-specific: path, URL, DSN, ...
    schedule: ScheduleSpec | None     # None = run-once; else cron/interval
```

A **TaskRun** is one execution of a TaskSpec:

```python
class TaskRun(BaseModel):
    id: UUID
    task_id: UUID
    started_at: datetime
    finished_at: datetime | None
    status: Literal["pending", "running", "succeeded", "failed", "cancelled"]
    dataset_id: UUID | None           # set on success
    error: str | None
    executor: str                     # name of the executor that ran it
```

The runner produces a **Dataset** on success. Datasets are owned by Invana, not the executor — they live in the mission's storage and feed the stitcher (§4.8).

### The `Executor` protocol

```python
class Executor(Protocol):
    name: str

    async def submit(self, spec: TaskSpec) -> TaskRun: ...
    async def cancel(self, run_id: UUID) -> None: ...
    async def status(self, run_id: UUID) -> TaskRun: ...
    async def stream_events(self, run_id: UUID) -> AsyncIterator[ExecutorEvent]: ...

    # Lifecycle hooks Invana calls when mission state changes
    async def freeze_mission(self, mission_id: UUID) -> None: ...
    async def thaw_mission(self, mission_id: UUID) -> None: ...
```

The contract:

- `submit` is **fire-and-forget from Invana's perspective**. The executor returns immediately with a `TaskRun(status="pending")`; actual execution happens asynchronously.
- The executor invokes the connector class in-process *or* out-of-process — that's its decision. What it *must* do is produce a Dataset and persist it via Invana's dataset-write API before marking the run `succeeded`.
- `freeze_mission` is called when a mission transitions `Open → Closed` (§4.10). Pending runs cancel; running runs complete but no new ones start. Idempotent.

### `LocalExecutor` (shipped in core)

- Single-process, asyncio.
- Holds a bounded worker pool (default: `min(cpu_count, 8)`). One global pool, **no per-mission caps**.
- **Connector invocation is in-process.** The worker imports the connector class and calls it directly in the same Python process. Simple, low-latency, easy to debug. A crashing connector takes down its worker (not the whole pool — workers are isolated coroutines, not threads). External executor adapters (Prefect / Temporal / …) are free to subprocess, sandbox, or remote-execute as they see fit.
- Persists `TaskSpec`, `TaskRun`, and a small `task_queue` table to the app DB; survives engine restart.
- Scheduling: simple interval/cron evaluator that fires due tasks into the worker pool.
- No retries by default; opt-in via `connector_config.retry = {...}` (max 3 attempts, exponential backoff).
- Observability: every state change writes a row to `task_run_events`. Streamable via SSE.

Explicitly **not** included in `LocalExecutor`:

- Cross-host scheduling.
- Priority queues.
- Per-mission resource quotas (slot caps, RAM tracking). Deferred — if you need this, that's the signal to switch to a real executor.
- Dead-letter queues.

If a user needs any of those, that is the signal to switch to a real executor.

### Pipelines

Pipelines as a first-class concept are **scoped down to "Task DAG"**: a directed acyclic graph of TaskSpecs with simple edge semantics (`run-after`, `run-after-success`). No fan-out templating, no parametrised sweeps, no conditional branches in v1.

A `Pipeline` persists as a list of TaskSpecs + edges. The executor receives the whole graph via `submit_pipeline(graph)`; `LocalExecutor` runs it with a topo-sort + worker pool. Real executors get to use their native DAG primitives.

If this turns out to be too thin to be worth a dedicated concept, we may drop `Pipeline` entirely in a follow-up and let users compose at the executor layer. This RFC commits to **shipping** the thin version and revisiting based on use.

### Discovery and configuration

Executors are registered like connectors (RFC-001): a class implementing the protocol, packaged with a `pyproject.toml` entry point under `invana.executors`. Invana picks the executor at runtime via:

```
INVANA_EXECUTOR=local                # default; bundled
INVANA_EXECUTOR=prefect              # requires `pip install invana-prefect`
INVANA_EXECUTOR=temporal             # requires `pip install invana-temporal`
```

Per-mission executor selection is **out of scope** for v1. One executor per Invana instance.

### Dataset write-back contract

The most important invariant: regardless of executor, the connector run produces a Dataset that is persisted via Invana's dataset API, not directly to storage. This API enforces:

- Dataset belongs to a valid, `Open` mission.
- System graph model is captured alongside records.
- Provenance metadata (`originating_task_run_id`, `connector_class`, `connector_version`) is recorded.
- Idempotency: a re-run of the same TaskSpec refreshes its Dataset in place (§5).

If an executor adapter bypasses this and writes Datasets directly, it breaks groundedness (§5). The executor protocol exposes a `dataset_writer` handle that adapters must use; direct DB writes from inside an adapter are a protocol violation.

The write-session shape:

```python
async with executor.open_dataset_writer(run) as writer:
    await writer.declare_schema(system_graph_model)       # required, exactly once, before any records
    async for record in connector.run(spec):
        await writer.append_record(record)
    # commit on context exit; rollback on exception
```

**Schema is declared upfront, exactly once, before the first record.** No mid-run schema extensions, no schema deltas. Records reference types from the declared model; references to undeclared types are rejected.

The tradeoff: connectors that *discover* entity types as records flow (PDF / DOCX extractors, web crawlers, free-text NER) cannot stream-and-extend. They have two options:

1. **Two-pass**: scan inputs once to infer the type universe, declare the schema, then emit records in a second pass. Costs one extra read; simple to reason about.
2. **Wide schema**: pre-declare a broad model (e.g. a single `Entity` node type with an open `properties: dict[str, Any]`) and let the user graph model + stitcher (§4.8) narrow it down semantically. Costs schema fidelity at the system-model layer, but stitching is where the real shape gets resolved anyway.

This is an intentional simplification of the write-session contract. If discovery-style connectors prove painful in practice, additive deltas (`extend_schema`) can be introduced in a follow-up without breaking the upfront-only path — but we are *not* paying for that complexity in v1.

### Cancellation semantics

When a `TaskRun` is cancelled mid-execution:

- All partial writes made by the connector are **rolled back**. No partial Dataset is persisted.
- The `TaskRun` row transitions to `status="cancelled"` with `dataset_id=NULL`.
- The dataset-writer API is transactional: connectors stream records into a write session, and the session either commits atomically on `succeeded` or discards on `cancelled` / `failed`.

This preserves the §5 contract: every Dataset that exists corresponds to a *completed* run. The stitcher never has to reason about partial state — partial state simply does not exist. The tradeoff is that long-running ingests lose their progress on cancel; that's accepted, because the alternative (a `partial=true` flag on Datasets) propagates an awkward state through the stitcher and the AI loop. If progress-on-cancel becomes a real need later, it lands as resumable runs, not as partial datasets.

### Event stream

Task-run events (status transitions, log lines, errors, dataset commit notifications) are exposed over a **single mission-level SSE endpoint** with optional server-side filtering:

```
GET /api/v1/missions/{mid}/events
GET /api/v1/missions/{mid}/events?run_id={rid}
GET /api/v1/missions/{mid}/events?task_id={tid}
```

- Studio opens one connection per open mission and multiplexes events into the UI; no `run_id` filter.
- Scripted clients passing a `run_id` or `task_id` get the filtered stream.
- One backend implementation (the event fan-out filters before flushing to the client), two access patterns.

This avoids the connection-sprawl that would result from per-run endpoints (a mission with N active runs would mean N open SSE connections from Studio). Per-task-spec filtering covers the scripted-client "watch this scheduled task" case without needing a dedicated endpoint.

Events are append-only rows in `task_run_events` and survive engine restart; the SSE endpoint replays from a client-supplied `Last-Event-ID` header before tailing the live stream.

### Protocol versioning

The `Executor` protocol lives in its own published package: **`invana-executor-protocol`**, with its own semver. Adapters depend on a range:

```toml
# invana-prefect/pyproject.toml
dependencies = ["invana-executor-protocol>=1.0,<2.0"]
```

The engine also pins a range and refuses to load adapters whose protocol version is outside it. Breaking changes to the protocol force a major bump; additive changes (new optional methods) are minor. This is the same pattern Click, Pydantic, and other Python ecosystems use for plugin contracts, and it decouples protocol churn from engine release cadence — important early on, when the protocol will iterate faster than the engine.

---

## Storage

Two new tables in the engine DB (Alembic migration on `arch/redesign`):

- `task_specs` — TaskSpec rows, `mission_id` FK with cascade per RFC-012.
- `task_runs` — TaskRun rows, `task_spec_id` FK, `dataset_id` FK (nullable).

Dataset storage already implied by §2 / §4.6 (separate from this RFC; covered in the engine module that owns Datasets).

---

## Alternatives Considered

| Alternative | Pros | Cons | Why not |
|---|---|---|---|
| **Status quo — keep building in-house orchestration** | Self-contained OSS, no external setup; consistent UX | Reinvents Prefect/Temporal/Dagster; will never reach feature parity | Wastes the differentiated work (stitcher, groundedness) on undifferentiated infra |
| **Mandatory external orchestrator** | Best-in-class scheduling from day one; tiny core | Kills the "open it and go" promise of §1; can't ship a demo image | Conflicts with the OS framing |
| **Pluggable (this RFC)** | Zero-config OSS *and* production-grade option | Two code paths to maintain (LocalExecutor + adapter API surface) | Recommended |
| **In-process Celery / RQ / Arq directly** | Mature Python schedulers; less code than LocalExecutor | Couples Invana to one Python-world scheduler; bad fit for non-Python orchestrators like Temporal | Picks a winner prematurely |

---

## Open Questions

All design questions from the drafting passes have been resolved and folded into the Design section above:

- **Connector isolation** — in-process for `LocalExecutor`; executor-adapter's choice otherwise.
- **Cancellation mid-run** — drop the partial dataset; no `partial=true` state.
- **Per-mission resource limits** — deferred; one global pool in v1.
- **Protocol versioning** — separate `invana-executor-protocol` package with its own semver.
- **Dataset write-session — schema timing** — upfront-only (`declare_schema` exactly once before any records); discovery-style connectors do a two-pass scan or pre-declare a wide schema. Additive deltas can be added later without breaking the upfront path.
- **Event stream granularity** — one mission-level SSE endpoint with optional `run_id` / `task_id` filtering. Studio multiplexes; scripted clients filter.

No remaining open questions block drafting the implementation. Items that will surface during implementation (exact event payload schemas, cron expression flavour, retry backoff curve) are routine and do not require RFC-level decisions.

---

## Implementation Plan

1. [ ] Land Dataset as a persisted entity (prereq — currently only conceptual in §2). Schema + write API + provenance fields.
2. [ ] Add `TaskSpec`, `TaskRun`, `task_run_events` tables + Alembic migration.
3. [ ] Implement the `Executor` protocol module + `LocalExecutor` (asyncio worker pool, simple scheduler, DB-persisted queue).
4. [ ] Wire mission `Open → Closed` transition to call `executor.freeze_mission`.
5. [ ] HTTP surface: `POST /api/v1/missions/{mid}/tasks`, `GET .../tasks/{id}/runs`, `POST .../runs/{id}:cancel`, SSE stream for events.
6. [ ] Studio: minimal "Tasks" tab per mission — list, trigger run, view dataset, view event stream.
7. [ ] Pipelines (thin DAG) — types, persistence, `submit_pipeline` on `LocalExecutor`. **Gate this step** on whether step 5–6 reveal a real need; otherwise skip and revisit.
8. [ ] Documentation: `docs/system-design.md` §4.6 cross-link to this RFC; `engine/CLAUDE.md` adds Executor to the "Don't" section (don't write directly to dataset storage from inside an adapter).
9. [ ] Reference adapter (out of scope for this RFC, tracked separately): `invana-prefect` as the first proof the protocol holds.

Per the user direction on `arch/redesign` (see `feedback_no_tests_on_redesign.md`), no automated tests are written. Verification is by manual run-through: create a mission, register a built-in connector, schedule a recurring task, watch a Dataset land, close the mission and confirm the schedule stops.

---

## References

- `docs/system-design.md` §2 (Task, Pipeline, Dataset), §4.6 (Running a connector), §4.10 (Closing a mission), §5 (Groundedness).
- RFC-001 — Graph Connectors (the integration-package pattern this RFC reuses for executor adapters).
- RFC-012 — Mission-Centric Architecture (delete cascade semantics applied to `task_specs` and `task_runs`).
- Prior art: Prefect (`@flow` / `@task`), Temporal (workflows + activities), Dagster (assets + ops), Hatchet, Hamilton's pluggable execution layer.
