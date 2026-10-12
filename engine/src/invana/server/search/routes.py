"""Path for search — ``/api/v1/search``.

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter

from invana.activity.schemas import SearchResponse
from invana.server.search import views

search_router = APIRouter(prefix="/api/v1/search", tags=["search"])

search_router.get("", response_model=SearchResponse)(views.search)

__all__ = ["search_router"]
