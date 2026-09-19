"""Paths for the Graph entity.

``/api/v1/graphs``                          — the collection
``/api/v1/u/{username}/{graphSlug}``        — one Graph, its connection and setup

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.apps.graphs.schemas import (
    ContentionRead,
    GraphConnectionRead,
    GraphListResponse,
    GraphRead,
)
from invana.server.graphs import views
from invana.server.schemas import ActionResponse

graphs_collection_router = APIRouter(prefix="/api/v1/graphs", tags=["graphs"])
graph_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}", tags=["graphs"])

graphs_collection_router.post("", response_model=GraphRead, status_code=status.HTTP_201_CREATED)(views.create_graph)
graphs_collection_router.get("", response_model=GraphListResponse)(views.list_graphs)
graph_router.get("", response_model=GraphRead)(views.get_graph)
graph_router.patch("", response_model=ActionResponse[GraphRead])(views.patch_graph)
graph_router.delete("", status_code=status.HTTP_204_NO_CONTENT)(views.delete_graph)
graph_router.get("/connection", response_model=GraphConnectionRead | None)(views.get_connection)
graph_router.put("/connection", response_model=GraphConnectionRead)(views.put_connection)
graph_router.delete("/connection", status_code=status.HTTP_204_NO_CONTENT)(views.delete_connection)
graph_router.post("/connection/acknowledge-version", response_model=GraphConnectionRead)(
    views.acknowledge_connection_version
)
graph_router.patch("/connection/version", response_model=GraphConnectionRead)(views.declare_connection_version)
graph_router.post("/setup/{section}", response_model=GraphRead)(views.update_setup_section)
graph_router.post("/connection/test")(views.test_connection)
graph_router.post("/connection/ping", status_code=status.HTTP_202_ACCEPTED)(views.ping_connection)
graph_router.post("/connection/introspect", status_code=status.HTTP_202_ACCEPTED)(views.introspect_connection)
graph_router.get("/contention", response_model=ContentionRead)(views.get_contention)

__all__ = ["graph_router", "graphs_collection_router"]
