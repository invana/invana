"""Service-layer tests for Boards (docs/for-developers/building-engine/boards-migration.md) — real
Postgres, no mocks.

Board persistence is app-DB only, so these never touch a graph database. They
exercise what distinguishes a board from its private backing session — shared
visibility, the 0..1 backing, archive and cascade — and the two rules the boards
model adds: a kind is one flat axis, and a declared board's row is created
lazily by the first thing that keeps something.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select

from invana.apps.boards.kinds import BOARD_KINDS, is_declared
from invana.apps.boards.managers import BoardManager, BoardVersionManager
from invana.apps.boards.models import Board
from invana.apps.boards.schemas import BoardCreate, BoardUpdate, BoardVersionCreate
from invana.core.errors import ConflictError, NotFoundError, ValidationError

pytestmark = pytest.mark.asyncio


boards = BoardManager()
versions = BoardVersionManager()


# ── The drawn board, as it always was ────────────────────────────────────────


async def test_create_defaults_title_and_source_query_from_session(session, graph, user, graph_session):
    """Creating with no title/query inherits them from the backing session."""
    board = await boards.create(
        session,
        graph_id=graph.id,
        user_id=user.id,
        payload=BoardCreate(session_id=graph_session.id, snapshot={"items": []}),
    )
    assert board.kind == "data"
    assert board.renders == "canvas"
    assert board.title == "My session"
    assert board.source_query == "MATCH (n) RETURN n LIMIT 3"
    assert board.snapshot == {"items": []}


async def test_board_is_shared_graph_wide(session, graph, user, other_user, graph_session):
    """A board is visible to any member — `get` scopes by graph only, not creator."""
    board = await boards.create(
        session, graph_id=graph.id, user_id=user.id, payload=BoardCreate(session_id=graph_session.id)
    )
    fetched = await boards.get(session, board_id=board.id, graph_id=graph.id)
    assert fetched.id == board.id

    items, total = await boards.list_for_graph(session, graph_id=graph.id, limit=30, offset=0)
    assert total == 1 and items[0].id == board.id


async def test_archive_hides_from_default_list(session, graph, user, graph_session):
    board = await boards.create(
        session, graph_id=graph.id, user_id=user.id, payload=BoardCreate(session_id=graph_session.id)
    )
    await boards.update(session, board=board, payload=BoardUpdate(archived=True), actor_id=user.id)
    _, total_default = await boards.list_for_graph(session, graph_id=graph.id, limit=30, offset=0)
    _, total_all = await boards.list_for_graph(session, graph_id=graph.id, limit=30, offset=0, include_archived=True)
    assert total_default == 0
    assert total_all == 1


async def test_deleting_backing_session_cascades_to_board(session, graph, user, graph_session):
    """Deleting the (private) session removes the (shared) board it backed."""
    board = await boards.create(
        session, graph_id=graph.id, user_id=user.id, payload=BoardCreate(session_id=graph_session.id)
    )
    board_id = board.id
    await session.delete(graph_session)
    await session.flush()
    remaining = (await session.execute(select(Board).where(Board.id == board_id))).scalar_one_or_none()
    assert remaining is None


async def test_create_from_another_users_session_is_404(session, graph, other_user, graph_session):
    """Sessions are private — you can't snapshot a board from someone else's session."""
    with pytest.raises(NotFoundError):
        await boards.create(
            session,
            graph_id=graph.id,
            user_id=other_user.id,  # not the session's creator
            payload=BoardCreate(session_id=graph_session.id),
        )


async def test_second_board_for_same_session_is_409(session, graph, user, graph_session):
    """A session backs at most one board."""
    await boards.create(session, graph_id=graph.id, user_id=user.id, payload=BoardCreate(session_id=graph_session.id))
    with pytest.raises(ConflictError):
        await boards.create(
            session, graph_id=graph.id, user_id=user.id, payload=BoardCreate(session_id=graph_session.id)
        )


# ── The kind axis ────────────────────────────────────────────────────────────


async def test_renders_is_read_from_the_registry_not_stored():
    """`canvas | dashboard` is a property of the kind, never a column (B3)."""
    assert BOARD_KINDS["data"].renders == "canvas"
    assert BOARD_KINDS["run"].renders == "dashboard"
    assert is_declared("run") and not is_declared("model")
    # A declared kind is identified by its subject, so it is always required.
    assert all(spec.subject_required for spec in BOARD_KINDS.values() if spec.renders == "dashboard")


async def test_a_data_board_without_a_session_is_rejected(session, graph, user):
    """`data` is the one kind born from a thread."""
    with pytest.raises(ValidationError):
        await boards.create(session, graph_id=graph.id, user_id=user.id, payload=BoardCreate(kind="data"))


async def test_a_kind_that_needs_a_subject_is_rejected_without_one(session, graph, user):
    with pytest.raises(ValidationError):
        await boards.create(session, graph_id=graph.id, user_id=user.id, payload=BoardCreate(kind="plan"))


async def test_a_board_that_needs_no_session_is_saved(session, graph, user):
    """The old schema could not hold this row at all — session_id was NOT NULL (B4)."""
    board = await boards.create(
        session,
        graph_id=graph.id,
        user_id=user.id,
        payload=BoardCreate(kind="plan", subject_id="plan-123", title="Q3 rollout"),
    )
    assert board.session_id is None
    assert board.kind == "plan" and board.subject_id == "plan-123"


async def test_one_board_per_subject(session, graph, user):
    await boards.create(
        session, graph_id=graph.id, user_id=user.id, payload=BoardCreate(kind="plan", subject_id="plan-123")
    )
    with pytest.raises(ConflictError):
        await boards.create(
            session, graph_id=graph.id, user_id=user.id, payload=BoardCreate(kind="plan", subject_id="plan-123")
        )


# ── The declared board: no row until something is kept ───────────────────────


async def test_saving_a_report_creates_the_row_and_reuses_it(session, graph, user):
    """A live dashboard has no row; the first report is what brings one into being (B9)."""
    _, before = await boards.list_for_graph(session, graph_id=graph.id, limit=30, offset=0)
    assert before == 0

    board = await boards.get_or_create_declared(
        session, graph_id=graph.id, user_id=user.id, kind="run", subject_id="run-abc"
    )
    report = await versions.create(
        session,
        board=board,
        user_id=user.id,
        payload=BoardVersionCreate(cause="report", label="At 14:20", snapshot={"rows": [{"panels": []}]}),
    )
    assert report.cause == "report"
    # The frozen document is stored merged and read back whole (B16).
    assert report.snapshot == {"rows": [{"panels": []}]}

    # A second report finds the same row rather than making another.
    again = await boards.get_or_create_declared(
        session, graph_id=graph.id, user_id=user.id, kind="run", subject_id="run-abc"
    )
    assert again.id == board.id
    _, after = await boards.list_for_graph(session, graph_id=graph.id, limit=30, offset=0)
    assert after == 1


async def test_a_drawn_kind_is_not_created_through_the_subject_path(session, graph, user):
    with pytest.raises(ValidationError):
        await boards.get_or_create_declared(session, graph_id=graph.id, user_id=user.id, kind="model", subject_id="m1")


async def test_versions_are_pruned_to_the_limit(session, graph, user, graph_session, monkeypatch):
    from invana.core.settings import settings

    monkeypatch.setattr(settings, "board_history_limit", 2)
    board = await boards.create(
        session, graph_id=graph.id, user_id=user.id, payload=BoardCreate(session_id=graph_session.id)
    )
    for i in range(4):
        await versions.create(
            session,
            board=board,
            user_id=user.id,
            payload=BoardVersionCreate(cause="query", label=f"v{i}", snapshot={"i": i}),
        )
    _, total = await versions.list_for_board(session, board_id=board.id, limit=30, offset=0)
    assert total == 2
