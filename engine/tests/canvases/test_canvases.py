"""Service-layer tests for Explorer Canvases (RFC-043) — real Postgres, no mocks.

Canvas persistence is app-DB only, so these never touch a graph database. They
exercise the shared-visibility, 1:1-backing, archive and cascade behaviours that
distinguish a canvas from its private backing session.
"""

from __future__ import annotations

from http import HTTPStatus

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from invana.canvases import services
from invana.canvases.models import Canvas
from invana.canvases.schemas import CanvasCreate, CanvasUpdate

pytestmark = pytest.mark.asyncio


async def test_create_defaults_title_and_source_query_from_session(session, graph, user, graph_session):
    """Creating with no title/query inherits them from the backing session."""
    canvas = await services.create_canvas(
        session,
        graph_id=graph.id,
        user_id=user.id,
        payload=CanvasCreate(session_id=graph_session.id, snapshot={"nodes": [], "edges": []}),
    )
    assert canvas.title == "My session"
    assert canvas.source_query == "MATCH (n) RETURN n LIMIT 3"
    assert canvas.session_id == graph_session.id
    assert canvas.snapshot == {"nodes": [], "edges": []}


async def test_canvas_is_shared_graph_wide(session, graph, user, other_user, graph_session):
    """A canvas is visible to any member — get_or_404 scopes by graph only, not creator."""
    canvas = await services.create_canvas(
        session, graph_id=graph.id, user_id=user.id, payload=CanvasCreate(session_id=graph_session.id)
    )
    # Fetched with only the graph id (as another member would) — no creator filter.
    fetched = await services.get_or_404(session, canvas_id=canvas.id, graph_id=graph.id)
    assert fetched.id == canvas.id

    items, total = await services.list_canvases(session, graph_id=graph.id, limit=30, offset=0)
    assert total == 1 and items[0].id == canvas.id


async def test_archive_hides_from_default_list(session, graph, user, graph_session):
    canvas = await services.create_canvas(
        session, graph_id=graph.id, user_id=user.id, payload=CanvasCreate(session_id=graph_session.id)
    )
    await services.update_canvas(session, canvas=canvas, payload=CanvasUpdate(archived=True), actor_id=user.id)
    _, total_default = await services.list_canvases(session, graph_id=graph.id, limit=30, offset=0)
    _, total_all = await services.list_canvases(session, graph_id=graph.id, limit=30, offset=0, include_archived=True)
    assert total_default == 0
    assert total_all == 1


async def test_update_title_and_instructions(session, graph, user, graph_session):
    canvas = await services.create_canvas(
        session, graph_id=graph.id, user_id=user.id, payload=CanvasCreate(session_id=graph_session.id)
    )
    await services.update_canvas(
        session,
        canvas=canvas,
        payload=CanvasUpdate(title="Renamed", instructions="Track fraud rings"),
        actor_id=user.id,
    )
    assert canvas.title == "Renamed"
    assert canvas.instructions == "Track fraud rings"


async def test_deleting_backing_session_cascades_to_canvas(session, graph, user, graph_session):
    """Decision 3 open risk: deleting the (private) session removes the (shared) canvas."""
    canvas = await services.create_canvas(
        session, graph_id=graph.id, user_id=user.id, payload=CanvasCreate(session_id=graph_session.id)
    )
    canvas_id = canvas.id
    await session.delete(graph_session)
    await session.flush()
    remaining = (await session.execute(select(Canvas).where(Canvas.id == canvas_id))).scalar_one_or_none()
    assert remaining is None


async def test_create_from_another_users_session_is_404(session, graph, other_user, graph_session):
    """Sessions are private — you can't snapshot a canvas from someone else's session."""
    with pytest.raises(HTTPException) as exc:
        await services.create_canvas(
            session,
            graph_id=graph.id,
            user_id=other_user.id,  # not the session's creator
            payload=CanvasCreate(session_id=graph_session.id),
        )
    assert exc.value.status_code == HTTPStatus.NOT_FOUND


async def test_second_canvas_for_same_session_is_409(session, graph, user, graph_session):
    """The hard 1:1 backing — a session backs at most one canvas."""
    await services.create_canvas(
        session, graph_id=graph.id, user_id=user.id, payload=CanvasCreate(session_id=graph_session.id)
    )
    with pytest.raises(HTTPException) as exc:
        await services.create_canvas(
            session, graph_id=graph.id, user_id=user.id, payload=CanvasCreate(session_id=graph_session.id)
        )
    assert exc.value.status_code == HTTPStatus.CONFLICT
