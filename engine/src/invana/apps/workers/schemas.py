"""Workers wire shapes — what `/api/v1/workers/*` reads and writes.

docs/for-developers/modules/agents/features/workers.md. Every number here is
stored by the engine (``worker_stats``, the worker row's heartbeat columns);
Studio formats them and derives none.

Two audiences share this module:

| Audience | Shapes |
|---|---|
| Studio, an install admin or a member | pools · workers · capacity · events · join tokens |
| A worker dialling out | ``JoinIn``/``Out`` · ``HeartbeatIn``/``Out`` · ``LeaseIn``/``Out`` · ``OutcomeIn`` |
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from invana.core.lists import Filter, ListSpec, Page

PoolState = Literal["keeping_up", "short", "no_workers", "healthy"]
RunsOnValue = Literal["docker", "python", "kubernetes"]
WorkerStateValue = Literal["starting", "busy", "idle", "draining", "lost", "stopped"]

POOL_LIST = ListSpec(filters={}, sorts=("name", "-created_at"))
WORKER_LIST = ListSpec(
    filters={
        "pool_id": Filter(title="pool"),
        "state": Filter(values=("busy", "idle", "starting", "lost", "draining", "stopped")),
    },
    sorts=("name", "-joined_at"),
)
EVENT_LIST = ListSpec(filters={"pool_id": Filter(title="pool")}, sorts=("-at",))
JOIN_TOKEN_LIST = ListSpec(filters={"pool_id": Filter(title="pool")}, sorts=("-created_at",))


# ── pools ─────────────────────────────────────────────────────────────────────


class PoolIn(BaseModel):
    name: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9][a-z0-9-]*$")
    runs_on: RunsOnValue = "python"
    labels: list[str] = Field(default_factory=list)
    slots_per_worker: int = Field(default=4, ge=1, le=256)
    plugins: list[str] = Field(default_factory=list)
    secrets: list[str] = Field(default_factory=list)
    egress: list[str] = Field(default_factory=list)


class PoolPatch(BaseModel):
    labels: list[str] | None = None
    slots_per_worker: int | None = Field(default=None, ge=1, le=256)
    plugins: list[str] | None = None
    secrets: list[str] | None = None
    egress: list[str] | None = None
    #: Replicas a person declared for a Kubernetes pool; sets ``set_by`` to replicas.
    replicas: int | None = Field(default=None, ge=0)


class PoolRow(BaseModel):
    id: str
    name: str
    runs_on: RunsOnValue
    #: *invana/worker deployment* · *4 hosts* · *invana worker* — what the pool runs on, in a line.
    runs_on_detail: str
    labels: list[str]
    slots_per_worker: int
    plugins: list[str]
    secrets: list[str]
    egress: list[str]
    set_by: Literal["hand", "replicas"]
    replicas: int | None = None
    workers: int
    starting: int
    lost: int
    slots: int
    slots_busy: int
    queued: int
    oldest_s: int | None = None
    state: PoolState
    created_at: datetime


class PoolPage(Page[PoolRow]):
    pass


class PoolTotals(BaseModel):
    """The Pools page tiles — every number from the latest ``worker_stats`` rows."""

    workers: int
    starting: int
    lost: int
    slots: int
    slots_busy: int
    #: ``slots_busy / slots`` as a whole percent; null with no slots.
    busy_pct: int | None = None
    queued: int
    oldest_s: int | None = None
    envelopes_a_minute: int
    #: Against the 7-day average a minute, as a whole percent; null without history.
    envelopes_vs_7d_pct: int | None = None
    lost_24h: int
    #: The worker lost most recently in 24 h, for the tile's caption.
    lost_24h_last: str | None = None


class SeriesPoint(BaseModel):
    at: datetime
    workers: int


class SeriesMark(BaseModel):
    at: datetime
    label: str


class PoolsOverview(BaseModel):
    """``GET /workers/overview`` — the Pools tab's tiles and its *Workers · last 30 min* chart."""

    executor: Literal["inline", "procrastinate"]
    totals: PoolTotals
    series: list[SeriesPoint]
    marks: list[SeriesMark]


# ── workers ───────────────────────────────────────────────────────────────────


class RunningStep(BaseModel):
    function: str
    run_id: str
    #: The run's short number, ``#2310``.
    run_number: int | None = None
    agent: str | None = None
    #: Seconds the step has run, computed by the engine at read time.
    for_s: int | None = None


class WorkerRow(BaseModel):
    id: str
    pool_id: str
    pool: str
    name: str
    node: str
    version: str
    labels: list[str]
    state: WorkerStateValue
    running: list[RunningStep]
    slots: int
    slots_busy: int
    #: Seconds since the last heartbeat.
    heartbeat_s: int | None = None
    #: Whole percent.
    cpu: int | None = None
    #: Seconds since it joined; null once lost or stopped.
    up_s: int | None = None
    #: *pulling image …* · *3 steps redelivered* — the state's line, when it has one.
    note: str | None = None
    joined_at: datetime
    from_ip: str | None = None


class WorkerStateCounts(BaseModel):
    all: int
    busy: int
    idle: int
    starting: int
    lost: int


class WorkerPage(Page[WorkerRow]):
    counts: WorkerStateCounts


class CpuPoint(BaseModel):
    at: datetime
    cpu: int | None = None


class WorkerLogLine(BaseModel):
    at: datetime
    line: str


class WorkerDetail(WorkerRow):
    """``GET /workers/{id}`` — C4."""

    steps_1h: int
    failed_1h: int
    #: p95 a step over the last hour, in milliseconds.
    p95_ms: int | None = None
    cpu_series: list[CpuPoint]
    log: list[WorkerLogLine]


# ── capacity · events ─────────────────────────────────────────────────────────


class CapacityRow(BaseModel):
    pool_id: str
    pool: str
    runs_on: RunsOnValue
    ready: int
    oldest_s: int | None = None
    workers: int
    #: Ready steps ÷ slots a worker over the last 10 min, clamped at zero.
    suggested: int
    state: PoolState
    #: The callout on a short pool: *8 more Docker workers would clear it ~20 min sooner*.
    callout: str | None = None
    #: A label steps wait for that no live pool carries.
    unroutable_label: str | None = None


class QueuePoint(BaseModel):
    at: datetime
    ready: int
    workers: int


class Capacity(BaseModel):
    rows: list[CapacityRow]
    computed_at: datetime | None = None
    #: The first short pool, whose last 10 min the *Queued and workers* chart draws.
    series_pool_id: str | None = None
    series: list[QueuePoint] = Field(default_factory=list)


class WorkerEventRow(BaseModel):
    id: str
    at: datetime
    pool_id: str
    pool: str
    worker: str | None = None
    change: Literal["joined", "lost", "drained", "stopped", "replicas"]
    #: *+2 workers* · *w-k8s-04 lost* — the Change column.
    change_text: str
    why: str
    actor: str | None = None


class WorkerEventPage(Page[WorkerEventRow]):
    pass


# ── join tokens ───────────────────────────────────────────────────────────────


class JoinTokenIn(BaseModel):
    pool_id: str
    name: str | None = Field(default=None, max_length=64)
    #: Days until it expires; null is never (*in a cluster secret*).
    expires_in_days: int | None = Field(default=7, ge=1, le=365)
    #: Workers it may admit; null is no cap.
    cap: int | None = Field(default=None, ge=1)


class JoinTokenRow(BaseModel):
    id: str
    #: ``invana_join_…7Hq2`` — never enough to rebuild the secret.
    display: str
    pool_id: str
    pool: str
    made_by: str | None = None
    expires_at: datetime | None = None
    joins: int
    cap: int | None = None
    last_used_at: datetime | None = None
    created_at: datetime
    revoked: bool = False


class JoinTokenPage(Page[JoinTokenRow]):
    pass


class JoinTokenCreated(JoinTokenRow):
    #: The secret, returned once.
    token: str
    #: Shown in *Run it*: the engine URL a worker dials.
    engine_url: str


class JoinCheck(BaseModel):
    key: Literal["token", "engine", "plugins", "labels", "heartbeat"]
    state: Literal["waiting", "ok", "failed"]
    #: *from 10.2.14.7* · *3 of 3* · *12 s* — the check's detail.
    detail: str | None = None
    #: What to check when it failed.
    fix: str | None = None


class JoinStatus(BaseModel):
    """``GET /workers/join-tokens/{id}/status`` — the *Joined* step's live checks."""

    token_id: str
    checks: list[JoinCheck]
    worker_id: str | None = None
    worker: str | None = None
    #: Workers that have joined with the token.
    joins: int = 0
    #: Seconds since the token was minted, for *waiting · 12 s*.
    waiting_s: int


# ── the worker's dial-out loop ────────────────────────────────────────────────


class JoinIn(BaseModel):
    pool: str
    name: str | None = None
    node: str = ""
    version: str = ""
    labels: list[str] = Field(default_factory=list)
    plugins: list[str] = Field(default_factory=list)
    slots: int | None = Field(default=None, ge=1, le=256)


class JoinOut(BaseModel):
    worker_id: str
    name: str
    pool: str
    labels: list[str]
    slots: int
    #: The worker's own credential, ``invana_wkr_…``; it authenticates every later call.
    credential: str
    heartbeat_s: int
    lease_wait_s: int


class HeartbeatIn(BaseModel):
    slots_busy: int = Field(default=0, ge=0)
    cpu: float | None = Field(default=None, ge=0)
    #: Log lines since the last heartbeat; the engine keeps the last few hundred.
    log: list[str] = Field(default_factory=list)


class HeartbeatOut(BaseModel):
    state: WorkerStateValue
    #: True once drained: finish what is held and stop.
    drain: bool
    #: A rotated credential; the worker uses it from the next call.
    credential: str | None = None


class LeaseIn(BaseModel):
    #: How many envelopes the worker can take now.
    free: int = Field(default=1, ge=1, le=256)


class Lease(BaseModel):
    job_id: int
    #: The ``TaskEnvelope`` as JSON.
    envelope: str


class LeaseOut(BaseModel):
    leases: list[Lease]


class OutcomeIn(BaseModel):
    job_id: int
    idempotency_key: str
    #: ``outcome_to_json`` of what the step returned or raised.
    outcome: dict
    artifacts: list[dict] = Field(default_factory=list)
    duration_ms: int | None = Field(default=None, ge=0)
