"""HTTP routes for the domain audit event log (RFC-018).

Two routers:

- ``events_router`` at ``/api/v1/events`` — superuser-only, all events.
- ``graph_events_router`` at ``/api/v1/u/{username}/{graphSlug}/events`` —
  any graph member, scoped to that graph.

Each has a paginated read + an SSE companion at ``/stream``.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from invana.auth.deps import require_superuser
from invana.auth.models import User
from invana.db import get_session
from invana.events.notify import EventBroadcaster, iter_frames
from invana.events.schemas import EventListResponse
from invana.events.store import EventFilter, EventStore
from invana.graphs.deps import require_graph_member, resolve_graph_by_username_slug
from invana.graphs.models import Graph, GraphMember

# ── Routers ──────────────────────────────────────────────────────────────────

events_router = APIRouter(prefix="/api/v1/events", tags=["events"])
graph_events_router = APIRouter(
    prefix="/api/v1/u/{username}/{graphSlug}/events",
    tags=["events"],
)


# ── Dep helpers ──────────────────────────────────────────────────────────────


def _get_broadcaster(request: Request) -> EventBroadcaster:
    return request.app.state.event_broadcaster


def _sse_response(generator) -> StreamingResponse:
    """Wrap an async generator of SSE frames into a StreamingResponse with the
    headers that keep proxies (nginx, ELB) from buffering or closing."""
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",  # nginx
            "Connection": "keep-alive",
        },
    )


# ── Global (superuser) ───────────────────────────────────────────────────────


@events_router.get("", response_model=EventListResponse)
async def list_events(
    cursor: str | None = Query(default=None),
    page_size: int = Query(default=50, ge=1, le=200),
    graph_id: str | None = Query(default=None),
    actor_id: str | None = Query(default=None),
    action_prefix: str | None = Query(default=None),
    since: datetime | None = Query(default=None),
    until: datetime | None = Query(default=None),
    _: User = Depends(require_superuser),
    session: AsyncSession = Depends(get_session),
) -> EventListResponse:
    """All events across the platform. Superuser only."""
    return await EventStore().list_page(
        session,
        filters=EventFilter(
            graph_id=graph_id,
            actor_id=actor_id,
            action_prefix=action_prefix,
            since=since,
            until=until,
        ),
        cursor=cursor,
        page_size=page_size,
    )


@events_router.get("/stream")
async def stream_events(
    request: Request,
    _: User = Depends(require_superuser),
) -> StreamingResponse:
    """SSE companion to the global list. Streams every new event row."""
    broadcaster = _get_broadcaster(request)
    sub = broadcaster.subscribe(graph_id_filter=None)
    return _sse_response(iter_frames(sub))


# ── Per-graph (member) ───────────────────────────────────────────────────────


@graph_events_router.get("", response_model=EventListResponse)
async def list_graph_events(
    cursor: str | None = Query(default=None),
    page_size: int = Query(default=50, ge=1, le=200),
    actor_id: str | None = Query(default=None),
    action_prefix: str | None = Query(default=None),
    since: datetime | None = Query(default=None),
    until: datetime | None = Query(default=None),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> EventListResponse:
    """Events for this graph only. Any graph member."""
    return await EventStore().list_page(
        session,
        filters=EventFilter(
            graph_id=graph.id,
            actor_id=actor_id,
            action_prefix=action_prefix,
            since=since,
            until=until,
        ),
        cursor=cursor,
        page_size=page_size,
    )


@graph_events_router.get("/stream")
async def stream_graph_events(
    request: Request,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
) -> StreamingResponse:
    """SSE companion for the per-graph view."""
    broadcaster = _get_broadcaster(request)
    sub = broadcaster.subscribe(graph_id_filter=graph.id)
    return _sse_response(iter_frames(sub))
