"""HTTP views for the ledger (docs/for-developers/modules/operate/features/the-ledger.md).

Parse, call one manager, serialise. Every route is a read open to every member;
the manager narrows what a member sees to their own acts and the rows of runs
they can open, and counts the rest. The export streams a file the manager has
already read whole, and records it; ``?full=true`` on integrity re-verifies the
chain now.
"""

from __future__ import annotations

from dataclasses import replace

from fastapi import Depends, Path, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers.ledger import LedgerManager
from invana.apps.graphs.models import Graph, GraphMember
from invana.core.db import get_session
from invana.core.ledger.schemas import (
    LEDGER_EXPORT_LIST,
    LEDGER_LIST,
    LedgerActorRead,
    LedgerExportRead,
    LedgerIntegrity,
    LedgerPage,
    LedgerRecordRead,
    LedgerRefusalsRead,
    LedgerRowDetail,
    LedgerStats,
)
from invana.core.lists import ListParams, Page, applied_filters, list_params
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

_ledger = LedgerManager()

#: The Rows filters, plus the file format the export reads itself.
EXPORT_LIST = replace(LEDGER_LIST, extra=frozenset({"format"}))


async def list_rows(
    params: ListParams = Depends(list_params(LEDGER_LIST)),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LedgerPage:
    return await _ledger.page(
        session, graph=graph, member=member, params=params, applied=applied_filters(params, LEDGER_LIST)
    )


async def get_stats(
    since: str = Query("today"),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LedgerStats:
    return await _ledger.stats(session, graph=graph, member=member, since=since)


async def get_row(
    row_id: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LedgerRowDetail:
    return await _ledger.detail(session, graph=graph, member=member, row_id=row_id)


async def get_actor(
    actor: str = Query(..., description="person:<id> or agent:<id>"),
    since: str = Query("7d"),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LedgerActorRead:
    return await _ledger.actor(session, graph=graph, member=member, actor=actor, since=since)


async def get_record(
    address: str = Query(..., description="graph/Airport:LHR, graph/Fare"),
    since: str = Query("30d"),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LedgerRecordRead:
    return await _ledger.record(session, graph=graph, member=member, address=address, since=since)


async def get_refusals(
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LedgerRefusalsRead:
    return await _ledger.refusals(session, graph=graph, member=member)


async def export_rows(
    format: str = Query("csv", description="csv or jsonl"),
    params: ListParams = Depends(list_params(EXPORT_LIST)),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    name, media_type, chunks = await _ledger.export(session, graph=graph, member=member, params=params, fmt=format)
    return StreamingResponse(
        iter(chunks), media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{name}"'}
    )


async def list_exports(
    params: ListParams = Depends(list_params(LEDGER_EXPORT_LIST)),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> Page[LedgerExportRead]:
    return await _ledger.exports(
        session, graph=graph, params=params, applied=applied_filters(params, LEDGER_EXPORT_LIST)
    )


async def get_integrity(
    full: bool = Query(False, description="Re-verify the whole chain now."),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LedgerIntegrity:
    return await _ledger.integrity(session, graph=graph, full=full)
