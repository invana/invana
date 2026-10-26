"""DB access layer for ``events`` rows."""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import Text, and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from invana.apps.agents.models import Agent
from invana.core.auth.models import User
from invana.core.events.actions import CHANGE_ACTIONS
from invana.core.events.models import Event
from invana.core.events.schemas import ActorRef, EventListResponse, EventRead, OnBehalfOfRef

# Hard ceiling on page size to keep the read endpoint cheap and predictable.
_MAX_PAGE_SIZE = 200
_DEFAULT_PAGE_SIZE = 50


@dataclass
class EventFilter:
    """Filters accepted by the read API. All optional, all combinable.

    The five added for the work surfaces (docs/for-developers/modules/work/spec.md) each read one dimension of the
    trace:
    *who kind of thing acted*, *for whom*, and the three scopes.
    """

    graph_id: str | None = None
    actor_id: str | None = None
    actor_kind: str | None = None
    on_behalf_of: str | None = None
    project_id: str | None = None
    #: Projects whose events the reader may not see — a private project they are not on.
    exclude_project_ids: frozenset[str] = frozenset()
    task_id: str | None = None
    run_id: str | None = None
    skill_id: str | None = None
    action_prefix: str | None = None
    actions: list[str] | None = None
    #: Only the events that mint a version — the change log.
    changes: bool = False
    since: datetime | None = None
    until: datetime | None = None


class EventQuerySet:
    async def add(self, session: AsyncSession, event: Event) -> Event:
        session.add(event)
        await session.flush()
        return event

    async def get(self, session: AsyncSession, event_id: str) -> Event | None:
        stmt = select(Event).where(Event.id == event_id)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def for_targets(
        self,
        session: AsyncSession,
        *,
        graph_id: str | None,
        target_kind: str,
        target_ids: list[str],
        actions: frozenset[str],
        any_graph: bool = False,
    ) -> list[Event]:
        """One record's events of the given actions, oldest first — what a
        record's history reads its who, when and why from.

        ``graph_id`` None reads the events of a record above Graphs (a
        dataset's, which carry none); ``any_graph`` drops the Graph filter, for
        the events a Graph-scoped act writes about such a record.
        """
        if not target_ids:
            return []
        where = [Event.target_kind == target_kind, Event.target_id.in_(target_ids), Event.action.in_(sorted(actions))]
        if not any_graph:
            where.append(Event.graph_id.is_(None) if graph_id is None else Event.graph_id == graph_id)
        stmt = select(Event).where(*where).order_by(Event.created_at, Event.id)
        return list((await session.execute(stmt)).scalars().all())

    async def of_action(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        actions: frozenset[str],
        target_id: str | None = None,
        newest_first: bool = True,
    ) -> list[tuple[Event, User | None]]:
        """A Graph's events of the given actions with their user actor, when it has one.

        ``target_id`` narrows to one record. Newest first by default; the actor is
        ``None`` for an agent, a system act or a user since deleted.
        """
        stmt = (
            select(Event, User)
            .outerjoin(User, User.id == Event.actor_id)
            .where(Event.graph_id == graph_id, Event.action.in_(sorted(actions)))
        )
        if target_id is not None:
            stmt = stmt.where(Event.target_id == target_id)
        order = (Event.created_at.desc(), Event.id.desc()) if newest_first else (Event.created_at, Event.id)
        return [(event, user) for event, user in (await session.execute(stmt.order_by(*order))).all()]

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

        # Three LEFT JOINs, none of them required to resolve: the actor is a
        # user OR an agent (never both — ``actor_kind`` decides which side is
        # non-null), and ``on_behalf_of`` is a user on agent rows only.
        behalf = aliased(User)
        stmt = (
            select(Event, User, Agent, behalf)
            .outerjoin(User, User.id == Event.actor_id)
            .outerjoin(Agent, Agent.id == Event.actor_id)
            .outerjoin(behalf, behalf.id == Event.on_behalf_of_user_id)
        )

        if filters.graph_id is not None:
            stmt = stmt.where(Event.graph_id == filters.graph_id)
        if filters.actor_id is not None:
            stmt = stmt.where(Event.actor_id == filters.actor_id)
        if filters.actor_kind is not None:
            stmt = stmt.where(Event.actor_kind == filters.actor_kind)
        if filters.on_behalf_of is not None:
            stmt = stmt.where(Event.on_behalf_of_user_id == filters.on_behalf_of)
        if filters.project_id is not None:
            stmt = stmt.where(Event.project_id == filters.project_id)
        if filters.exclude_project_ids:
            stmt = stmt.where(
                or_(Event.project_id.is_(None), Event.project_id.not_in(sorted(filters.exclude_project_ids))),
            )
        if filters.task_id is not None:
            stmt = stmt.where(Event.task_id == filters.task_id)
        if filters.run_id is not None:
            stmt = stmt.where(Event.run_id == filters.run_id)
        if filters.skill_id is not None:
            # ``skill_ids`` is a JSON array, and JSON containment differs between
            # SQLite and Postgres. A LIKE over the serialised text is the one
            # form both accept; ids are UUIDs, so a false positive is not a
            # practical concern.
            stmt = stmt.where(Event.skill_ids.cast(Text).like(f'%"{filters.skill_id}"%'))
        if filters.action_prefix is not None:
            # Strict prefix match; trailing dot already in caller's input or
            # we treat any non-empty prefix as a startswith. Use LIKE so the
            # composite (action, created_at) index can be used.
            stmt = stmt.where(Event.action.like(f"{filters.action_prefix}%"))
        if filters.actions:
            # Exact-match set; the UI's multi-select sends the chosen event
            # types here. IN keeps the composite (action, created_at) index
            # usable. Empty list = no constraint (treated as "all").
            stmt = stmt.where(Event.action.in_(filters.actions))
        if filters.changes:
            # ANDed with ``actions``, so a chosen type outside the change log
            # narrows to nothing rather than widening back to everything.
            stmt = stmt.where(Event.action.in_(sorted(CHANGE_ACTIONS)))
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
        for event, user, agent, behalf_user in rows:
            items.append(
                EventRead(
                    id=event.id,
                    graph_id=event.graph_id,
                    actor=_user_ref(user),
                    actor_kind=event.actor_kind,
                    # A retired agent still reads by name because the row stays;
                    # a *deleted* one falls back to the snapshot in ``details``.
                    actor_name=(agent.name if agent is not None else event.details.get("actor_name")),
                    on_behalf_of=_behalf_ref(behalf_user),
                    parent_event_id=event.parent_event_id,
                    project_id=event.project_id,
                    task_id=event.task_id,
                    run_id=event.run_id,
                    node_run_id=event.node_run_id,
                    skill_ids=list(event.skill_ids or []),
                    action=event.action,
                    target_kind=event.target_kind,
                    target_id=event.target_id,
                    details=event.details,
                    trace_id=event.trace_id,
                    span_id=event.span_id,
                    created_at=event.created_at,
                ),
            )

        next_cursor: str | None = None
        if has_more and items:
            tail = items[-1]
            next_cursor = _encode_cursor(_Keyset(created_at=tail.created_at, id=tail.id))

        return EventListResponse(items=items, next_cursor=next_cursor)


def _display_name(user: User) -> str:
    return f"{user.first_name} {user.last_name}".strip() if user.last_name else user.first_name


def _user_ref(user: User | None) -> ActorRef | None:
    if user is None:
        return None
    return ActorRef(id=user.id, username=user.username, display_name=_display_name(user))


def _behalf_ref(user: User | None) -> OnBehalfOfRef | None:
    if user is None:
        return None
    return OnBehalfOfRef(id=user.id, username=user.username, display_name=_display_name(user))


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
    except Exception:
        return None
