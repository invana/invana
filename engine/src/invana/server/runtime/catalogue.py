"""The catalogue, read-only (docs/for-developers/modules/workflows/features/the-catalogue.md).

Routes
------
GET /catalogue   every entry, grouped by bound, with how many plans name it

Graph-scoped only so *used by* can be answered; the entries themselves are the
engine's, the same in every Graph (CA1).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph, GraphMember
from invana.core.db import get_session
from invana.runtime.managers import CatalogueManager
from invana.runtime.schemas import CatalogueResponse
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

catalogue_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/catalogue", tags=["catalogue"])

catalogue = CatalogueManager()


@catalogue_router.get("", response_model=CatalogueResponse)
async def list_catalogue(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> CatalogueResponse:
    return await catalogue.list(session, graph_id=graph.id)
