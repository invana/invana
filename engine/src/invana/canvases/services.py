"""Service layer for Explorer Canvases (RFC-043).

Owns canvas persistence. Canvases are **shared graph-wide** (``get_or_404``
enforces graph scope only, not creator), but each is created from — and backed
1:1 by — a session the creator owns.
"""

from __future__ import annotations

from http import HTTPStatus

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from invana.canvases.models import Canvas
from invana.canvases.schemas import CanvasCreate, CanvasUpdate
from invana.canvases.store import CanvasStore
from invana.events import actions
from invana.events.services import current_trace_id, emit_event
from invana.sessions import services as session_services
from invana.sessions.store import SessionStore


async def list_canvases(
    session: AsyncSession,
    *,
    graph_id: str,
    limit: int,
    offset: int,
    sort: str = "updated",
    include_archived: bool = False,
) -> tuple[list[Canvas], int]:
    store = CanvasStore()
    items = await store.list_for_graph(
        session,
        graph_id=graph_id,
        limit=limit,
        offset=offset,
        sort=sort,
        include_archived=include_archived,
    )
    total = await store.count_for_graph(session, graph_id=graph_id, include_archived=include_archived)
    return items, total


async def get_or_404(session: AsyncSession, *, canvas_id: str, graph_id: str) -> Canvas:
    """Fetch a canvas, enforcing graph scope only — canvases are shared."""
    canvas = await CanvasStore().get(session, canvas_id)
    if canvas is None or canvas.graph_id != graph_id:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="Canvas not found.")
    return canvas


async def _latest_source_query(session: AsyncSession, *, session_id: str) -> str | None:
    """The most recent message's ``source_query`` in the backing session, if any."""
    messages = await SessionStore().list_messages(session, session_id=session_id)
    for msg in reversed(messages):
        if msg.source_query:
            return msg.source_query
    return None


async def create_canvas(
    session: AsyncSession,
    *,
    graph_id: str,
    user_id: str,
    payload: CanvasCreate,
) -> Canvas:
    # Validate the backing session: must exist, be in this graph, and belong to
    # the creator (sessions are private — you can only snapshot your own).
    sess = await session_services.get_or_404(session, session_id=payload.session_id, graph_id=graph_id, user_id=user_id)
    # Enforce the hard 1:1 — a session backs at most one canvas.
    if await CanvasStore().get_by_session(session, sess.id) is not None:
        raise HTTPException(
            status_code=HTTPStatus.CONFLICT,
            detail="This session already has a canvas.",
        )

    canvas = Canvas(
        session_id=sess.id,
        graph_id=graph_id,
        created_by_id=user_id,
        title=(payload.title or sess.title or "Untitled canvas"),
        instructions=payload.instructions or "",
        snapshot=payload.snapshot or {},
        source_query=payload.source_query or await _latest_source_query(session, session_id=sess.id),
        view_state=payload.view_state or {},
        filters=payload.filters or {},
        positions=payload.positions or {},
        settings=payload.settings or {},
        styling=payload.styling or {},
    )
    await CanvasStore().add(session, canvas)
    await emit_event(
        session,
        action=actions.CANVAS_CREATE,
        target_kind=actions.TARGET_CANVAS,
        target_id=canvas.id,
        graph_id=graph_id,
        actor_id=user_id,
        details={"session_id": sess.id, "title": canvas.title},
        trace_id=current_trace_id(),
    )
    return canvas


async def update_canvas(
    session: AsyncSession,
    *,
    canvas: Canvas,
    payload: CanvasUpdate,
    actor_id: str,
) -> Canvas:
    """Apply a partial update (only the fields present in the payload)."""
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(canvas, field, value)
    await session.flush()
    await emit_event(
        session,
        action=actions.CANVAS_UPDATE,
        target_kind=actions.TARGET_CANVAS,
        target_id=canvas.id,
        graph_id=canvas.graph_id,
        actor_id=actor_id,
        # Don't log the heavy render blobs — just which fields changed.
        details={"fields": sorted(changes.keys())},
        trace_id=current_trace_id(),
    )
    return canvas


async def delete_canvas(session: AsyncSession, *, canvas: Canvas, actor_id: str) -> None:
    canvas_id = canvas.id
    graph_id = canvas.graph_id
    await CanvasStore().delete(session, canvas)
    await emit_event(
        session,
        action=actions.CANVAS_DELETE,
        target_kind=actions.TARGET_CANVAS,
        target_id=canvas_id,
        graph_id=graph_id,
        actor_id=actor_id,
        details={},
        trace_id=current_trace_id(),
    )
