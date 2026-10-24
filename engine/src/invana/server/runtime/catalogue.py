"""The catalogue, read-only (docs/for-developers/modules/workflows/features/the-catalogue.md).

Routes
------
GET /catalogue                    the entries, grouped by bound, with how many plans name each
GET /catalogue/{step_key}         one function's page — its contract, who names it, its calls over 30 days
GET /catalogue/{step_key}/calls   the run steps that called it, newest first, on the list contract

Graph-scoped only so *used by* and the calls can be answered; the entries
themselves are the engine's, the same in every Graph.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph, GraphMember
from invana.core.db import get_session
from invana.core.lists import ListParams, Page, applied_filters, list_params
from invana.runtime.managers import CatalogueManager
from invana.runtime.schemas import (
    CATALOGUE_LIST,
    FUNCTION_CALLS_LIST,
    CatalogueEntryRead,
    FunctionCallRead,
    FunctionRead,
)
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

catalogue_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/catalogue", tags=["catalogue"])

catalogue = CatalogueManager()


@catalogue_router.get("", response_model=Page[CatalogueEntryRead])
async def list_catalogue(
    params: ListParams = Depends(list_params(CATALOGUE_LIST)),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> Page[CatalogueEntryRead]:
    items, info = await catalogue.page(session, graph_id=graph.id, params=params)
    return Page[CatalogueEntryRead].of(items, info, applied_filters(params, CATALOGUE_LIST))


@catalogue_router.get("/{step_key}", response_model=FunctionRead)
async def get_function(
    step_key: str,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> FunctionRead:
    return await catalogue.function(session, graph_id=graph.id, key=step_key)


@catalogue_router.get("/{step_key}/calls", response_model=Page[FunctionCallRead])
async def list_function_calls(
    step_key: str,
    params: ListParams = Depends(list_params(FUNCTION_CALLS_LIST)),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> Page[FunctionCallRead]:
    items, info = await catalogue.calls(session, graph_id=graph.id, key=step_key, params=params)
    return Page[FunctionCallRead].of(items, info, applied_filters(params, FUNCTION_CALLS_LIST))
