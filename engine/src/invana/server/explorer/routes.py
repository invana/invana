"""Paths for the Explorer, under ``/api/v1/u/{username}/{graphSlug}/explorer``.

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter

from invana.apps.explorer.schemas import (
    NeighborExpandResponse,
    ResolveElementsResponse,
    TypeCountsResponse,
)
from invana.server.explorer import views

explorer_router = APIRouter(
    prefix="/api/v1/u/{username}/{graphSlug}/explorer",
    tags=["explorer"],
)

explorer_router.post("/expand/neighbors", response_model=NeighborExpandResponse)(views.expand_neighbors)
explorer_router.post("/expand/by-edge-type", response_model=NeighborExpandResponse)(views.expand_by_edge_type)
explorer_router.post("/expand/by-node-type", response_model=NeighborExpandResponse)(views.expand_by_node_type)
explorer_router.post("/resolve", response_model=ResolveElementsResponse)(views.resolve_elements)
explorer_router.get("/type-counts", response_model=TypeCountsResponse)(views.type_counts)
