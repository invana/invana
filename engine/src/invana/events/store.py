"""DB access layer for ``events`` rows."""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.auth.models import User
from invana.events.models import Event
from invana.events.schemas import ActorRef, EventListResponse, EventRead

# Hard ceiling on page size to keep the read endpoint cheap and predictable.
_MAX_PAGE_SIZE = 200
_DEFAULT_PAGE_SIZE = 50


@dataclass
class EventFilter:
    """Filters accepted by the read API. All optional, all combinable."""

    graph_id: str | None = None
    actor_id: str | None = None
    action_prefix: str | None = None
    since: datetime | None = None
    until: datetime | None = None


class EventStore:
    async def add(self, session: AsyncSession, event: Event) -> Event:
        session.add(event)
        await session.flush()
        return event

    async def get(self, session: AsyncSession, event_id: str) -> Event | None:
        stmt = select(Event).where(Event.id == event_id)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def list_page(
        self,
        session: AsyncSession,
        *,
        filters: EventFilter,
        cursor: str | None,
        page_size: int = _DEFAULT_PAGE_SIZE,
    ) -> EventListResponse:
        """Keyset-paginated read with optional filters.

        Joins ``users`` so the response can include the denormalised actor
        ref without a second roundtrip.
        """

        page_size = max(1, min(page_size, _MAX_PAGE_SIZE))

        # Keyset cursor: opaque base64(json({"created_at": iso, "id": uuid})).
        # The page boundary is (created_at < c.created_at) OR
        # (created_at = c.created_at AND id < c.id) — keeps ties stable.
        keyset = _decode_cursor(cursor)

        stmt = select(Event, User).outerjoin(User, User.id == Event.actor_id)

        if filters.graph_id is not None:
            stmt = stmt.where(Event.graph_id == filters.graph_id)
        if filters.actor_id is not None:
            stmt = stmt.where(Event.actor_id == filters.actor_id)
        if filters.action_prefix is not None:
            # Strict prefix match; trailing dot already in caller's input or
            # we treat any non-empty prefix as a startswith. Use LIKE so the
            # composite (action, created_at) index can be used.
            stmt = stmt.where(Event.action.like(f"{filters.action_prefix}%"))
        if filters.since is not None:
            stmt = stmt.where(Event.created_at >= filters.since)
        if filters.until is not None:
            stmt = stmt.where(Event.created_at < filters.until)
        if keyset is not None:
            stmt = stmt.where(
                or_(
                    Event.created_at < keyset.created_at,
                    and_(
                        Event.created_at == keyset.created_at,
                        Event.id < keyset.id,
                    ),
                ),
            )

        stmt = stmt.order_by(Event.created_at.desc(), Event.id.desc()).limit(page_size + 1)

        rows = (await session.execute(stmt)).all()
        has_more = len(rows) > page_size
        rows = rows[:page_size]

        items: list[EventRead] = []
        for event, user in rows:
            actor_ref: ActorRef | None = None
            if user is not None:
                display = f"{user.first_name} {user.last_name}".strip() if user.last_name else user.first_name
                actor_ref = ActorRef(
                    id=user.id,
                    username=user.username,
                    display_name=display,
                )
            items.append(
                EventRead(
                    id=event.id,
                    graph_id=event.graph_id,
                    actor=actor_ref,
                    actor_type=event.actor_type,
                    action=event.action,
                    target_kind=event.target_kind,
                    target_id=event.target_id,
                    details=event.details,
                    trace_id=event.trace_id,
                    created_at=event.created_at,
                ),
            )

        next_cursor: str | None = None
        if has_more and items:
            tail = items[-1]
            next_cursor = _encode_cursor(_Keyset(created_at=tail.created_at, id=tail.id))

        return EventListResponse(items=items, next_cursor=next_cursor)


# ── Keyset helpers ───────────────────────────────────────────────────────────


@dataclass
class _Keyset:
    created_at: datetime
    id: str


def _encode_cursor(k: _Keyset) -> str:
    raw = json.dumps({"created_at": k.created_at.isoformat(), "id": k.id})
    return base64.urlsafe_b64encode(raw.encode()).rstrip(b"=").decode()


def _decode_cursor(cursor: str | None) -> _Keyset | None:
    if cursor is None:
        return None
    # Re-pad base64 if needed.
    padded = cursor + "=" * (-len(cursor) % 4)
    try:
        raw = base64.urlsafe_b64decode(padded.encode()).decode()
        obj = json.loads(raw)
        return _Keyset(created_at=datetime.fromisoformat(obj["created_at"]), id=obj["id"])
    except Exception:  # noqa: BLE001 — opaque cursor; reject by treating as no-cursor
        return None
