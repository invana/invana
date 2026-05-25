"""LISTEN/NOTIFY daemon + in-process broadcaster for live event tail (RFC-018).

One daemon connection per worker process LISTENs on the Postgres ``events``
channel. The `events_notify_insert` trigger fires ``pg_notify`` after every
INSERT; the daemon parses the payload and fans it out to every subscriber's
asyncio queue. SSE handlers pull from their queue and write each frame to
the client.

Subscribers register with an optional ``graph_id_filter`` — only events
matching that graph are delivered to them. The global stream uses
``graph_id_filter=None`` and receives everything.

Per-client queue has a hard cap; on overflow we drop the oldest frames and
send a ``lost`` sentinel so the client can refetch the missed page.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

import asyncpg

from invana.settings import settings

log = logging.getLogger(__name__)

# Per-subscriber queue cap. Tuned to soak short bursts (e.g. a bulk import
# emitting hundreds of skill.create in quick succession) without unbounded
# memory growth if a client stalls.
_QUEUE_CAP = 1000


@dataclass
class NotifyPayload:
    """Decoded payload from the events_notify_insert trigger."""

    id: str
    graph_id: str | None
    created_at: str  # ISO-8601 UTC; parsing happens on the SSE handler side


@dataclass
class _Subscriber:
    queue: asyncio.Queue[NotifyPayload | None]
    graph_id_filter: str | None
    lost_count: int = field(default=0)


class EventBroadcaster:
    """In-process pub/sub fed by a single LISTEN connection per worker.

    Lifecycle is managed by the FastAPI app's `lifespan` (start on app boot,
    cancel + close on shutdown). Idempotent: ``start`` is a no-op if already
    running, ``stop`` is a no-op if not running.
    """

    def __init__(self) -> None:
        self._conn: asyncpg.Connection | None = None
        self._task: asyncio.Task[None] | None = None
        self._subscribers: set[_Subscriber] = set()
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        async with self._lock:
            if self._task is not None and not self._task.done():
                return
            self._task = asyncio.create_task(self._run(), name="invana.events.listen")
            log.info("EventBroadcaster: LISTEN daemon started")

    async def stop(self) -> None:
        async with self._lock:
            if self._task is None:
                return
            task = self._task
            self._task = None
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
        if self._conn is not None:
            with contextlib.suppress(Exception):
                await self._conn.close()
            self._conn = None
        # Signal all subscribers to stop reading.
        for sub in self._subscribers:
            sub.queue.put_nowait(None)
        self._subscribers.clear()
        log.info("EventBroadcaster: LISTEN daemon stopped")

    # ── Subscribe / unsubscribe ────────────────────────────────────────────

    def subscribe(self, *, graph_id_filter: str | None = None) -> _Subscriber:
        sub = _Subscriber(
            queue=asyncio.Queue(maxsize=_QUEUE_CAP),
            graph_id_filter=graph_id_filter,
        )
        self._subscribers.add(sub)
        return sub

    def unsubscribe(self, sub: _Subscriber) -> None:
        self._subscribers.discard(sub)

    # ── LISTEN loop ────────────────────────────────────────────────────────

    async def _run(self) -> None:
        """Open a dedicated asyncpg connection, LISTEN, fan out forever."""
        # Build a direct asyncpg DSN from the async SQLAlchemy URL. We bypass
        # SQLAlchemy here because asyncpg's LISTEN/NOTIFY is connection-scoped
        # and SQLAlchemy's session is unsuited to long-lived listeners.
        url = settings.database_url
        # SQLAlchemy URL is `postgresql+asyncpg://…`; asyncpg wants `postgresql://…`.
        dsn = url.replace("postgresql+asyncpg://", "postgresql://", 1)

        backoff = 1.0
        while True:
            try:
                self._conn = await asyncpg.connect(dsn=dsn)
                await self._conn.add_listener("events", self._on_notify)
                log.info("EventBroadcaster: LISTEN events established")
                backoff = 1.0
                # Stay parked here forever; the listener fires in the
                # connection's read loop. A CancelledError unwinds us.
                while True:
                    await asyncio.sleep(3600)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                log.warning(
                    "EventBroadcaster: LISTEN connection dropped (%s); retry in %.1fs",
                    exc,
                    backoff,
                )
                if self._conn is not None:
                    with contextlib.suppress(Exception):
                        await self._conn.close()
                    self._conn = None
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30.0)

    def _on_notify(
        self,
        _conn: asyncpg.Connection,
        _pid: int,
        _channel: str,
        payload: str,
    ) -> None:
        try:
            obj = json.loads(payload)
            np = NotifyPayload(
                id=obj["id"],
                graph_id=obj.get("graph_id"),
                created_at=obj["created_at"],
            )
        except Exception:
            log.warning("EventBroadcaster: malformed NOTIFY payload, dropping")
            return

        # Fan out to interested subscribers.
        for sub in list(self._subscribers):
            if sub.graph_id_filter is not None and sub.graph_id_filter != np.graph_id:
                continue
            try:
                sub.queue.put_nowait(np)
            except asyncio.QueueFull:
                # Drop the oldest to make room; bump the lost counter so the
                # next iter_frames() call can surface a `lost` sentinel.
                with contextlib.suppress(asyncio.QueueEmpty):
                    sub.queue.get_nowait()
                sub.lost_count += 1
                with contextlib.suppress(asyncio.QueueFull):
                    sub.queue.put_nowait(np)


# Module-level singleton — the FastAPI app instance holds a reference via
# `app.state.event_broadcaster` set during lifespan, but a process-wide
# singleton is convenient for service code that wants to ad-hoc notify
# without going through the DB trigger (currently unused — all writes go
# through the trigger).
broadcaster = EventBroadcaster()


# ── SSE frame iterator ────────────────────────────────────────────────────────


async def iter_frames(sub: _Subscriber) -> AsyncIterator[str]:
    """Yield SSE-formatted frames for one subscriber.

    Each frame is either:
    - ``event: row\\ndata: {"id": "..."}\\n\\n`` for a new event, or
    - ``event: lost\\ndata: {"count": N}\\n\\n`` when the queue dropped
      events to make room (the client should refetch).

    Heartbeats (``: keepalive\\n\\n``) are emitted every 25s when no real
    frames are flowing so reverse proxies don't close the idle connection.
    """
    try:
        while True:
            if sub.lost_count > 0:
                count = sub.lost_count
                sub.lost_count = 0
                yield f"event: lost\ndata: {json.dumps({'count': count})}\n\n"
                continue
            try:
                np = await asyncio.wait_for(sub.queue.get(), timeout=25.0)
            except TimeoutError:
                yield ": keepalive\n\n"
                continue
            if np is None:
                # Broadcaster shut down; close the stream cleanly.
                return
            payload = {
                "id": np.id,
                "graph_id": np.graph_id,
                "created_at": np.created_at,
            }
            yield f"event: row\ndata: {json.dumps(payload)}\n\n"
    finally:
        broadcaster.unsubscribe(sub)
