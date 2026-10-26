"""Worker records: pools, the workers that joined them, what happened to them, and their numbers.

docs/for-developers/modules/agents/features/workers.md.

Tables
------
- ``worker_pools``   — a labelled set of workers; install-wide.
- ``workers``        — one joined worker: its pool, labels, credential and last heartbeat.
- ``worker_events``  — joined · lost · drained · stopped · replicas, with why.
- ``worker_stats``   — every number Workers shows, one row a pool every 30 s.

A join token is not a table of its own: it is a ``personal_access_tokens`` row
narrowed to one pool (``worker_pool_id`` · ``join_cap`` · ``joins``), held by the
install's ``workers`` service account. Workers are not principals — a worker's
credential admits it to the gateway routes and nothing else.
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, BigInteger, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from invana.core.models import Base


def _new_id() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(UTC)


class RunsOn(enum.StrEnum):
    docker = "docker"
    python = "python"
    kubernetes = "kubernetes"


class SetBy(enum.StrEnum):
    hand = "hand"
    replicas = "replicas"


class WorkerState(enum.StrEnum):
    starting = "starting"
    busy = "busy"
    idle = "idle"
    draining = "draining"
    lost = "lost"
    stopped = "stopped"


class WorkerChange(enum.StrEnum):
    joined = "joined"
    lost = "lost"
    drained = "drained"
    stopped = "stopped"
    replicas = "replicas"


class WorkerPool(Base):
    """A labelled set of workers any of which may run a step its labels cover."""

    __tablename__ = "worker_pools"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    runs_on: Mapped[str] = mapped_column(String(16), nullable=False, default=RunsOn.python.value)
    labels: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    slots_per_worker: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    plugins: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # Secret names only; the values live on the worker's machine.
    secrets: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # Domains a worker of this pool may reach.
    egress: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    set_by: Mapped[str] = mapped_column(String(16), nullable=False, default=SetBy.hand.value)
    # Replicas a person declared for a Kubernetes pool; Invana never starts them.
    replicas: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class Worker(Base):
    """One process that joined a pool and leases its steps over HTTPS."""

    __tablename__ = "workers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    pool_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("worker_pools.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    node: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    version: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    labels: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    plugins: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    slots: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    state: Mapped[str] = mapped_column(String(16), nullable=False, default=WorkerState.starting.value, index=True)
    # Busy slots and CPU from the last heartbeat.
    slots_busy: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cpu: Mapped[float | None] = mapped_column(Float, nullable=True)
    credential_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    # Honoured until the next rotation, so a request in flight does not fail.
    previous_credential_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    credential_rotated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    # procrastinate's worker id — the jobs this worker holds are fetched under it.
    queue_worker_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    joined_via: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("personal_access_tokens.id", ondelete="SET NULL"), nullable=True
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    from_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Steps redelivered when it was lost.
    redelivered: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class WorkerEvent(Base):
    """One change to a pool or a worker, with why."""

    __tablename__ = "worker_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    pool_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("worker_pools.id", ondelete="CASCADE"), nullable=False, index=True
    )
    worker_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("workers.id", ondelete="SET NULL"), nullable=True
    )
    change: Mapped[str] = mapped_column(String(16), nullable=False)
    # Also carries the delta a change made (+2 workers).
    detail: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    why: Mapped[str] = mapped_column(Text, nullable=False, default="")
    actor_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False, index=True)


class WorkerStat(Base):
    """A pool's numbers in one 30 s bucket, written by the engine."""

    __tablename__ = "worker_stats"

    pool_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("worker_pools.id", ondelete="CASCADE"), primary_key=True
    )
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    workers: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    starting: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lost: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    slots: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    slots_busy: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ready: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    oldest_s: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Envelopes this pool finished in the bucket.
    envelopes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    suggested: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
