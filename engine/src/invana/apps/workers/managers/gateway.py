"""The rules of a worker dialling out — join, authenticate, heartbeat, lose.

docs/for-developers/modules/agents/features/workers.md C8 · C9. These are the
database half of the gateway; the queue half (registering with procrastinate,
leasing, finishing jobs) is :mod:`invana.plugins.gateway`, which calls these.

| Step | Rule |
|---|---|
| join | live token with joins left, naming this pool; labels and plugins fit the pool; own credential issued |
| authenticate | a worker credential, or the one before it until the next rotation |
| heartbeat | stamps busy slots, CPU and time; rotates a credential an hour old; stops a drained worker |
| lose | silent past the limit, the worker is ``lost`` and an event says how many steps were redelivered |

Join errors name what to fix: a refused join tells the person running the
worker which of the token, the pool or the labels was wrong.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.workers import logs
from invana.apps.workers.credentials import JOIN_PREFIX, WORKER_PREFIX, hash_token, new_worker_credential
from invana.apps.workers.models import Worker, WorkerChange, WorkerEvent, WorkerPool, WorkerState
from invana.apps.workers.querysets.events import WorkerEventQuerySet
from invana.apps.workers.querysets.pools import PoolQuerySet
from invana.apps.workers.querysets.tokens import JoinTokenQuerySet
from invana.apps.workers.querysets.workers import WorkerQuerySet
from invana.apps.workers.schemas import HeartbeatIn, HeartbeatOut, JoinIn
from invana.core.errors import AuthenticationError, ConflictError, ValidationError

#: A worker credential is replaced by a heartbeat this long after the last one.
ROTATE_AFTER = timedelta(hours=1)
MINT_HINT = "Workers > Join tokens"


class WorkerGatewayManager:
    """Stateless. The session is the first argument of every method."""

    tokens = JoinTokenQuerySet()
    pools = PoolQuerySet()
    workers = WorkerQuerySet()
    events = WorkerEventQuerySet()

    async def _live_token(self, session: AsyncSession, raw: str):
        if not raw.startswith(JOIN_PREFIX):
            raise AuthenticationError(f"Join with a join token ({JOIN_PREFIX}...) made in {MINT_HINT}.")
        token = await self.tokens.by_hash(session, hash_token(raw))
        if token is None:
            raise AuthenticationError(f"Unknown join token. Check the token, or mint a new one in {MINT_HINT}.")
        if token.revoked_at is not None:
            raise AuthenticationError(f"This join token was revoked. Mint a new one in {MINT_HINT}.")
        if token.expires_at is not None and token.expires_at <= datetime.now(UTC):
            raise AuthenticationError(f"This join token has expired. Mint a new one in {MINT_HINT}.")
        return token

    async def _name(self, session: AsyncSession, pool: WorkerPool, asked: str | None) -> str:
        if asked:
            if await self.workers.live_name_taken(session, asked):
                raise ConflictError(f"A worker named '{asked}' is already running. Choose another --name.")
            return asked
        n = await self.workers.count_in_pool(session, pool.id) + 1
        while True:
            candidates = [f"w-{pool.name}-{i:02d}" for i in range(n, n + 20)]
            taken = await self.workers.names_taken(session, candidates)
            free = [c for c in candidates if c not in taken]
            if free:
                return free[0]
            n += 20

    async def admit(
        self, session: AsyncSession, *, raw_token: str, payload: JoinIn, from_ip: str | None
    ) -> tuple[Worker, str, WorkerPool]:
        """Admit a worker on a join token; returns the worker, its credential (once) and its pool."""
        token = await self._live_token(session, raw_token)
        pool = await self.pools.get_by_name(session, payload.pool)
        if pool is None or pool.id != token.worker_pool_id:
            tokens_pool = await self.pools.get(session, token.worker_pool_id or "")
            raise ValidationError(
                f"This join token joins pool '{tokens_pool.name if tokens_pool else '?'}', not '{payload.pool}'. "
                "Pass --pool with that name, or mint a token for the pool you mean."
            )
        labels = [label.strip().lower() for label in (payload.labels or pool.labels or []) if label.strip()]
        outside = sorted(set(labels) - set(pool.labels or []))
        if outside:
            has = ", ".join(pool.labels or []) or "no labels"
            raise ValidationError(
                f"Labels {', '.join(outside)} are not in pool '{pool.name}' ({has}). "
                "Drop them from --labels, or add them to the pool."
            )
        missing = sorted(set(pool.plugins or []) - set(payload.plugins))
        if missing:
            raise ValidationError(
                f"Pool '{pool.name}' needs the plugins {', '.join(missing)}, which this worker has not loaded. "
                "Install them where the worker runs."
            )
        name = await self._name(session, pool, payload.name)
        if not await self.tokens.claim_join(session, token.id):
            raise ValidationError(
                f"This join token has admitted the {token.join_cap} workers it may. Mint another in {MINT_HINT}."
            )
        token.last_used_at = datetime.now(UTC)
        secret = new_worker_credential()
        worker = await self.workers.add(
            session,
            Worker(
                pool_id=pool.id,
                name=name,
                node=payload.node,
                version=payload.version,
                labels=labels,
                plugins=list(payload.plugins),
                slots=payload.slots or pool.slots_per_worker,
                state=WorkerState.starting.value,
                credential_hash=hash_token(secret),
                joined_via=token.id,
                from_ip=from_ip,
            ),
        )
        await self.events.add(
            session,
            WorkerEvent(
                pool_id=pool.id,
                worker_id=worker.id,
                change=WorkerChange.joined.value,
                detail={"worker": worker.name, "delta": 1},
                why=f"{worker.name} joined {pool.name}" + (f" from {from_ip}" if from_ip else ""),
            ),
        )
        return worker, secret, pool

    async def authenticate(self, session: AsyncSession, raw: str) -> Worker:
        """The worker a credential belongs to, or ``AuthenticationError``."""
        if not raw.startswith(WORKER_PREFIX):
            raise AuthenticationError("Call this route with the worker credential from the join.")
        worker = await self.workers.by_credential(session, hash_token(raw))
        if worker is None:
            raise AuthenticationError("Unknown worker credential. Join again with a join token.")
        if worker.state == WorkerState.stopped.value:
            raise AuthenticationError("This worker was drained and stopped. Start it again to join.")
        return worker

    async def beat(self, session: AsyncSession, worker: Worker, payload: HeartbeatIn) -> tuple[HeartbeatOut, bool]:
        """Record a heartbeat; returns what to answer and whether a lost worker came back."""
        now = datetime.now(UTC)
        revived = worker.state == WorkerState.lost.value
        worker.slots_busy = min(payload.slots_busy, worker.slots)
        worker.cpu = payload.cpu
        worker.last_heartbeat_at = now
        logs.add_log(worker.id, payload.log)
        logs.add_cpu(worker.id, payload.cpu)

        drain = worker.state == WorkerState.draining.value
        if drain and worker.slots_busy == 0:
            worker.state = WorkerState.stopped.value
            await self.events.add(
                session,
                WorkerEvent(
                    pool_id=worker.pool_id,
                    worker_id=worker.id,
                    change=WorkerChange.stopped.value,
                    detail={"worker": worker.name, "delta": -1},
                    why=f"{worker.name} finished its steps and stopped",
                ),
            )
        elif not drain:
            worker.state = WorkerState.busy.value if worker.slots_busy else WorkerState.idle.value

        rotated: str | None = None
        if now - worker.credential_rotated_at >= ROTATE_AFTER:
            rotated = new_worker_credential()
            worker.previous_credential_hash = worker.credential_hash
            worker.credential_hash = hash_token(rotated)
            worker.credential_rotated_at = now
        await session.flush()
        return HeartbeatOut(state=worker.state, drain=drain, credential=rotated), revived

    async def mark_lost(self, session: AsyncSession, worker: Worker, *, redelivered: int, silent_s: int) -> None:
        worker.state = WorkerState.lost.value
        worker.slots_busy = 0
        worker.redelivered = redelivered
        worker.queue_worker_id = None
        await self.events.add(
            session,
            WorkerEvent(
                pool_id=worker.pool_id,
                worker_id=worker.id,
                change=WorkerChange.lost.value,
                detail={"worker": worker.name, "delta": -1, "redelivered": redelivered},
                why=f"no heartbeat {silent_s} s · {redelivered} steps redelivered",
            ),
        )
