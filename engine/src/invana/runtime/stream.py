"""The run_ask stream: persist-then-broadcast run_ask frames, and SSE framing (docs/for-developers/modules/ask/spec.md).

``Broadcaster`` is the in-process fan-out — one ``asyncio.Queue`` per
subscriber, keyed by run id. Producer and consumers share the API process
in the MVP, so no LISTEN/NOTIFY hop is needed; the ``subscribe(run_id,
after)`` shape is the seam an out-of-process executor plugs into later.

A *frame* is not an *emission*: a frame is how anything travels — a step
transition, a diagnosis, an emission arriving — while an emission is the
produced answer part a reader sees (docs/for-developers/terminology.md, Ask K9).

``Emitter`` appends a row to ``task_stream`` (its own short DB session,
committed) **before** publishing, so a subscriber that connects a moment later
replays exactly what a live one saw.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from invana.runtime.models import TaskRun, TaskStream

log = logging.getLogger(__name__)

# Frame kinds that end a subscription.
TERMINAL_KINDS = frozenset({"run.done", "run.cancelled", "clarification.requested"})

_QUEUE_MAX = 2000
_KEEPALIVE_S = 25.0


@dataclass(slots=True)
class Frame:
    seq: int
    kind: str
    payload: dict

    def as_frame(self) -> str:
        """One SSE frame. ``id`` carries the seq so ``Last-Event-ID`` resumes the tail."""
        data = json.dumps({"seq": self.seq, "kind": self.kind, "payload": self.payload})
        return f"id: {self.seq}\nevent: {self.kind}\ndata: {data}\n\n"


class Broadcaster:
    """In-process pub/sub keyed by run id."""

    def __init__(self) -> None:
        self._subs: dict[str, set[asyncio.Queue[Frame | None]]] = {}

    def publish(self, run_id: str, frame: Frame) -> None:
        for q in list(self._subs.get(run_id, ())):
            with contextlib.suppress(asyncio.QueueFull):
                q.put_nowait(frame)

    def close(self, run_id: str) -> None:
        """Wake every subscriber of a run so a dead run never hangs a tail."""
        for q in list(self._subs.get(run_id, ())):
            with contextlib.suppress(asyncio.QueueFull):
                q.put_nowait(None)

    @contextlib.contextmanager
    def attach(self, run_id: str):
        q: asyncio.Queue[Frame | None] = asyncio.Queue(maxsize=_QUEUE_MAX)
        self._subs.setdefault(run_id, set()).add(q)
        try:
            yield q
        finally:
            subs = self._subs.get(run_id)
            if subs is not None:
                subs.discard(q)
                if not subs:
                    self._subs.pop(run_id, None)


broadcaster = Broadcaster()


async def replay(session: AsyncSession, *, run_id: str, after: int) -> list[Frame]:
    rows = (
        await session.execute(
            select(TaskStream).where(TaskStream.run_id == run_id, TaskStream.seq > after).order_by(TaskStream.seq)
        )
    ).scalars()
    return [Frame(seq=r.seq, kind=r.kind, payload=r.payload) for r in rows]


def _json_default(value: object) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


class Emitter:
    """Append to a run's stream, then broadcast."""

    def __init__(self, session_factory: async_sessionmaker[AsyncSession], run_id: str) -> None:
        self._factory = session_factory
        self.run_id = run_id
        self._lock = asyncio.Lock()

    async def emit(self, kind: str, payload: dict | None = None, *, idem_key: str | None = None) -> Frame:
        # Normalise once so the stored row and the live frame carry the same
        # JSON (datetimes → ISO strings, pydantic dumps → plain dicts).
        payload = json.loads(json.dumps(payload or {}, default=_json_default))
        async with self._lock, self._factory() as db:
            seq = int(
                (
                    await db.execute(
                        update(TaskRun)
                        .where(TaskRun.id == self.run_id)
                        .values(stream_seq=TaskRun.stream_seq + 1)
                        .returning(TaskRun.stream_seq)
                    )
                ).scalar_one()
            )
            db.add(TaskStream(run_id=self.run_id, seq=seq, kind=kind, payload=payload or {}, idem_key=idem_key))
            await db.commit()
        frame = Frame(seq=seq, kind=kind, payload=payload or {})
        broadcaster.publish(self.run_id, frame)
        return frame


async def subscribe(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    run_id: str,
    after: int,
) -> AsyncIterator[str]:
    """SSE frames for one run: replay from the record, then tail live.

    Attaches to the broadcaster **before** replaying so nothing emitted in
    between is missed (duplicates are dropped by seq). Ends after a terminal
    frame; a ``: keepalive`` comment every 25 s keeps proxies from closing an
    idle tail. Mirrors ``events.notify.iter_frames``.
    """
    with broadcaster.attach(run_id) as q:
        async with session_factory() as db:
            backlog = await replay(db, run_id=run_id, after=after)
            status = (await db.execute(select(TaskRun.status).where(TaskRun.id == run_id))).scalar_one_or_none()
        for e in backlog:
            after = e.seq
            yield e.as_frame()
            if e.kind in TERMINAL_KINDS:
                return
        # Nothing more will come from a settled run with no terminal frame
        # in the backlog (pre-runtime rows, or a run the reconciler failed).
        if status in {"succeeded", "failed", "cancelled"} and not backlog:
            return
        while True:
            try:
                e = await asyncio.wait_for(q.get(), timeout=_KEEPALIVE_S)
            except TimeoutError:
                yield ": keepalive\n\n"
                continue
            if e is None:
                return
            if e.seq <= after:
                continue
            after = e.seq
            yield e.as_frame()
            if e.kind in TERMINAL_KINDS:
                return
