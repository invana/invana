"""Paths for this Graph's MCP server, under ``/api/v1/u/{username}/{graphSlug}``.

=========================================  ==============================================
POST ``/mcp``                              one JSON-RPC message, answered with JSON
GET · DELETE ``/mcp``                      405 — no stream, no session to end
GET ``/connections/server``                the endpoint card and the head's counts
GET ``/connections/server/served``         every candidate and its Served switch (``Page``)
PUT ``/connections/server/served/{k}/{r}`` turn one candidate's switch on or off
GET ``/connections/server/calls``          the newest calls (``Page``)
=========================================  ==============================================

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter

from invana.apps.mcp_server.schemas import McpCallPage, McpServerInfo, ServedPage, ServedRead
from invana.server.mcp_server import views

mcp_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}", tags=["mcp-server"])

mcp_router.post("/mcp", response_model=None)(views.post_mcp)
mcp_router.get("/mcp", response_model=None, include_in_schema=False)(views.no_stream)
mcp_router.delete("/mcp", response_model=None, include_in_schema=False)(views.no_stream)
mcp_router.get("/connections/server", response_model=McpServerInfo)(views.server_info)
mcp_router.get("/connections/server/served", response_model=ServedPage)(views.list_served)
mcp_router.put("/connections/server/served/{kind}/{ref}", response_model=ServedRead)(views.set_served)
mcp_router.get("/connections/server/calls", response_model=McpCallPage)(views.list_calls)
