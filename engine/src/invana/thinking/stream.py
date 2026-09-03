"""The thought stream: persist-then-broadcast emissions, and SSE framing (RFC-048).

``Broadcaster`` is the in-process fan-out — one ``asyncio.Queue`` per
subscriber, keyed by thinking id. Producer and consumers share the API process
in the MVP, so no LISTEN/NOTIFY hop is needed; the ``subscribe(thinking_id,
after)`` shape is the seam an out-of-process executor plugs into later.

``Emitter`` appends a row to ``thought_stream`` (its own short DB session,
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

from invana.thinking.models import Thinking, ThoughtStream

log = logging.getLogger(__name__)

# Emission kinds that end a subscription.
TERMINAL_KINDS = frozenset({"thinking.done", "thinking.cancelled", "clarification.requested"})

_QUEUE_MAX = 2000
_KEEPALIVE_S = 25.0


@dataclass(slots=True)
class Emission:
    seq: int
    kind: str
    payload: dict

    def as_frame(self) -> str:
        """One SSE frame. ``id`` carries the seq so ``Last-Event-ID`` resumes the tail."""
        data = json.dumps({"seq": self.seq, "kind": self.kind, "payload": self.payload})
        return f"id: {self.seq}\nevent: {self.kind}\ndata: {data}\n\n"


class Broadcaster:
    """In-process pub/sub keyed by thinking id."""

    def __init__(self) -> None:
        self._subs: dict[str, set[asyncio.Queue[Emission | None]]] = {}

    def publish(self, thinking_id: str, emission: Emission) -> None:
        for q in list(self._subs.get(thinking_id, ())):
            with contextlib.suppress(asyncio.QueueFull):
                q.put_nowait(emission)

    def close(self, thinking_id: str) -> None:
        """Wake every subscriber of a thinking so a dead run never hangs a tail."""
        for q in list(self._subs.get(thinking_id, ())):
            with contextlib.suppress(asyncio.QueueFull):
                q.put_nowait(None)

    @contextlib.contextmanager
    def attach(self, thinking_id: str):
        q: asyncio.Queue[Emission | None] = asyncio.Queue(maxsize=_QUEUE_MAX)
        self._subs.setdefault(thinking_id, set()).add(q)
        try:
            yield q
        finally:
            subs = self._subs.get(thinking_id)
            if subs is not None:
                subs.discard(q)
                if not subs:
                    self._subs.pop(thinking_id, None)


broadcaster = Broadcaster()


async def replay(session: AsyncSession, *, thinking_id: str, after: int) -> list[Emission]:
    rows = (
        await session.execute(
            select(ThoughtStream)
            .where(ThoughtStream.thinking_id == thinking_id, ThoughtStream.seq > after)
            .order_by(ThoughtStream.seq)
        )
    ).scalars()
    return [Emission(seq=r.seq, kind=r.kind, payload=r.payload) for r in rows]


def _json_default(value: object) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


class Emitter:
    """Append to a thinking's stream, then broadcast."""

    def __init__(self, session_factory: async_sessionmaker[AsyncSession], thinking_id: str) -> None:
        self._factory = session_factory
        self.thinking_id = thinking_id
        self._lock = asyncio.Lock()

    async def emit(self, kind: str, payload: dict | None = None, *, idem_key: str | None = None) -> Emission:
        # Normalise once so the stored row and the live frame carry the same
        # JSON (datetimes → ISO strings, pydantic dumps → plain dicts).
        payload = json.loads(json.dumps(payload or {}, default=_json_default))
        async with self._lock, self._factory() as db:
            seq = int(
                (
                    await db.execute(
                        update(Thinking)
                        .where(Thinking.id == self.thinking_id)
                        .values(stream_seq=Thinking.stream_seq + 1)
                        .returning(Thinking.stream_seq)
                    )
                ).scalar_one()
            )
            db.add(
                ThoughtStream(
                    thinking_id=self.thinking_id, seq=seq, kind=kind, payload=payload or {}, idem_key=idem_key
                )
            )
            await db.commit()
        emission = Emission(seq=seq, kind=kind, payload=payload or {})
        broadcaster.publish(self.thinking_id, emission)
        return emission


async def subscribe(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    thinking_id: str,
    after: int,
) -> AsyncIterator[str]:
    """SSE frames for one thinking: replay from the record, then tail live.

    Attaches to the broadcaster **before** replaying so nothing emitted in
    between is missed (duplicates are dropped by seq). Ends after a terminal
    emission; a ``: keepalive`` comment every 25 s keeps proxies from closing an
    idle tail. Mirrors ``events.notify.iter_frames``.
    """
    with broadcaster.attach(thinking_id) as q:
        async with session_factory() as db:
            backlog = await replay(db, thinking_id=thinking_id, after=after)
            status = (await db.execute(select(Thinking.status).where(Thinking.id == thinking_id))).scalar_one_or_none()
        for e in backlog:
            after = e.seq
            yield e.as_frame()
            if e.kind in TERMINAL_KINDS:
                return
        # Nothing more will come from a settled thinking with no terminal frame
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
