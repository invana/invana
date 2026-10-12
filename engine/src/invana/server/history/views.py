"""HTTP handlers for a record's history and a compare of two of its versions.

Parse, call ``ChangeLogManager``, return — the manager assembles the versions,
the events that minted them and the runs that came after.
"""

from __future__ import annotations

from fastapi import Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers import ChangeLogManager
from invana.activity.schemas import ChangeCompare, RecordHistory
from invana.apps.graphs.models import Graph, GraphMember
from invana.core.db import get_session
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

changes = ChangeLogManager()


async def record_history(
    record_kind: str = Path(..., description="skill · rule · plan · agent · model"),
    record_id: str = Path(..., description="The record's id; a plan's key."),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> RecordHistory:
    """Every version of one record, newest first: who, when, why, what changed
    against the one before, and the effect after."""
    return await changes.history(session, graph_id=graph.id, record_kind=record_kind, record_id=record_id)


async def compare_versions(
    record_kind: str = Path(...),
    record_id: str = Path(...),
    b: str = Query(..., description="The version to read to."),
    a: str | None = Query(default=None, description="The version to read from; omitted is the one before b."),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ChangeCompare:
    """Two versions of one record, side by side."""
    return await changes.compare(session, graph_id=graph.id, record_kind=record_kind, record_id=record_id, a=a, b=b)
