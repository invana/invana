"""HTTP view for search across everything the caller may open.

docs/for-developers/modules/platform/features/search.md. Parse, call
``SearchManager``, return — access is the manager's to decide.
"""

from __future__ import annotations

from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers import SearchManager
from invana.activity.managers.search import DEFAULT_LIMIT, MAX_LIMIT
from invana.activity.schemas import SearchResponse
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session


async def search(
    q: str = Query(..., min_length=1, max_length=200, description="Text to match against names."),
    graph: str | None = Query(None, description="Narrow to one Graph, as <username>/<slug>."),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SearchResponse:
    return await SearchManager().search(session, reader=user, text=q, graph_ref=graph, limit=limit)
