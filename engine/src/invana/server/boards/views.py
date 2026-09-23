"""HTTP views for Boards (docs/for-developers/building-engine/boards-migration.md § 3.4).

Boards are **shared across every graph member** — contrast sessions, which are
private. The views gate on ``require_graph_member`` only and never filter by
creator.

Parse, call one manager, serialise (migration-plan §4.1).
"""

from __future__ import annotations

from typing import Literal

from fastapi import Depends, Path, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.boards.kinds import BoardKindName
from invana.apps.boards.managers import BoardManager, BoardVersionManager
from invana.apps.boards.schemas import (
    BoardCreate,
    BoardDetail,
    BoardListResponse,
    BoardSummary,
    BoardUpdate,
    BoardVersionCreate,
    BoardVersionDetail,
    BoardVersionListResponse,
    BoardVersionSummary,
)
from invana.apps.graphs.models import Graph, GraphMember
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.errors import NotFoundError
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

boards = BoardManager()
versions = BoardVersionManager()


async def list_boards(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    sort: Literal["updated", "created"] = Query(default="updated"),
    include_archived: bool = Query(default=False),
    kind: BoardKindName | None = Query(default=None),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> BoardListResponse:
    items, total = await boards.list_for_graph(
        session,
        graph_id=graph.id,
        limit=limit,
        offset=offset,
        sort=sort,
        include_archived=include_archived,
        kind=kind,
    )
    return BoardListResponse(items=[BoardSummary.model_validate(b) for b in items], total=total)


async def create_board(
    payload: BoardCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> BoardDetail:
    board = await boards.create(session, graph_id=graph.id, user_id=user.id, payload=payload)
    return BoardDetail.model_validate(board)


async def get_board(
    board_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> BoardDetail:
    board = await boards.get(session, board_id=board_id, graph_id=graph.id)
    return BoardDetail.model_validate(board)


async def update_board(
    payload: BoardUpdate,
    board_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> BoardDetail:
    board = await boards.get(session, board_id=board_id, graph_id=graph.id)
    await boards.update(session, board=board, payload=payload, actor_id=user.id)
    return BoardDetail.model_validate(board)


async def delete_board(
    board_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    board = await boards.get(session, board_id=board_id, graph_id=graph.id)
    await boards.delete(session, board=board, actor_id=user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Versions ─────────────────────────────────────────────────────────────────


async def list_board_versions(
    board_id: str = Path(...),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> BoardVersionListResponse:
    # Confirm the board is in this graph before listing its history.
    await boards.get(session, board_id=board_id, graph_id=graph.id)
    items, total = await versions.list_for_board(session, board_id=board_id, limit=limit, offset=offset)
    return BoardVersionListResponse(
        items=[BoardVersionSummary.model_validate(v) for v in items],
        total=total,
    )


async def create_board_version(
    payload: BoardVersionCreate,
    board_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> BoardVersionDetail:
    board = await boards.get(session, board_id=board_id, graph_id=graph.id)
    version = await versions.create(session, board=board, user_id=user.id, payload=payload)
    return BoardVersionDetail.model_validate(version)


async def get_board_version(
    board_id: str = Path(...),
    version_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> BoardVersionDetail:
    version = await versions.get(session, version_id=version_id, board_id=board_id, graph_id=graph.id)
    return BoardVersionDetail.model_validate(version)


# ── A declared board, addressed by its subject (B9) ──────────────────────────
#
# A live dashboard has no row. These three paths are the only ones that need
# one, so each is create-or-get on `(graph_id, kind, subject_id)` and the client
# never asks whether a row exists.


async def save_report(
    payload: BoardVersionCreate,
    kind: BoardKindName = Path(...),
    subject_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> BoardVersionDetail:
    board = await boards.get_or_create_declared(
        session,
        graph_id=graph.id,
        user_id=user.id,
        kind=kind,
        subject_id=subject_id,
        title=payload.label,
    )
    version = await versions.create(session, board=board, user_id=user.id, payload=payload)
    return BoardVersionDetail.model_validate(version)


async def list_reports(
    kind: BoardKindName = Path(...),
    subject_id: str = Path(...),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> BoardVersionListResponse:
    board = await boards.boards_qs.get_by_subject(session, graph_id=graph.id, kind=kind, subject_id=subject_id)
    # No row means nothing was ever kept — an empty list, not a 404. The live
    # dashboard is still there; it simply has no reports.
    if board is None:
        return BoardVersionListResponse(items=[], total=0)
    items, total = await versions.list_for_board(session, board_id=board.id, limit=limit, offset=offset)
    return BoardVersionListResponse(
        items=[BoardVersionSummary.model_validate(v) for v in items],
        total=total,
    )


async def get_report(
    kind: BoardKindName = Path(...),
    subject_id: str = Path(...),
    version_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> BoardVersionDetail:
    board = await boards.boards_qs.get_by_subject(session, graph_id=graph.id, kind=kind, subject_id=subject_id)
    if board is None:
        raise NotFoundError("Board version not found.")
    version = await versions.get(session, version_id=version_id, board_id=board.id, graph_id=graph.id)
    return BoardVersionDetail.model_validate(version)
