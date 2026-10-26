"""HTTP handlers for this Graph's MCP server — parse, call ``McpServerManager``, serialise.

``POST /mcp`` takes an IAM token and nothing else. A ``tools/call`` that opens a
run is worked here, in the request (``run_inline``), because the caller waits on
its answer: the run's rows are committed first so the runtime reads them in its
own session, then the settled run is read back as the tool's result. The
Connections reads are any member's; flipping a Served switch is the *build*
area, read off the route by the graph gate.
"""

from __future__ import annotations

import json

from fastapi import Depends, Path, Query, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.mcp_server.schemas import (
    SERVED_LIST,
    McpCallPage,
    McpServerInfo,
    ServedPage,
    ServedRead,
    ServedUpdate,
)
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.lists import ListParams, applied_filters, list_params
from invana.runtime.managers.mcp_server import PARSE_ERROR, Credential, McpServerManager
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

mcp = McpServerManager()

_TOKEN_ONLY = {
    "jsonrpc": "2.0",
    "id": None,
    "error": {"code": -32001, "message": "This endpoint takes an IAM token in the Authorization header."},
}


async def post_mcp(
    request: Request,
    username: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    user: User = Depends(get_current_user),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Answer one JSON-RPC message from an MCP client."""
    state = request.state
    if getattr(state, "auth_credential", None) != "personal_access_token":
        return JSONResponse(_TOKEN_ONLY, status_code=status.HTTP_401_UNAUTHORIZED)
    try:
        message = json.loads(await request.body())
    except ValueError:
        body = {"jsonrpc": "2.0", "id": None, "error": {"code": PARSE_ERROR, "message": "The body is not JSON."}}
        return JSONResponse(body, status_code=status.HTTP_400_BAD_REQUEST)
    statements = getattr(state, "auth_token_statements", None)
    credential = Credential(
        token_id=state.auth_token_id,
        token_name=state.auth_token_name,
        narrowing=(state.auth_token_policy, statements) if statements is not None else None,
    )
    reply = await mcp.handle(
        session,
        graph=graph,
        caller=user,
        credential=credential,
        message=message,
        session_id=request.headers.get("Mcp-Session-Id"),
    )
    if reply.run_id:
        run_id = reply.run_id
        await session.commit()
        await request.app.state.task_runtime.run_inline(run_id)
        reply = await mcp.finish(session, run_id=run_id, message=message)
    if reply.body is None:
        return Response(status_code=reply.status, headers=reply.headers)
    return JSONResponse(reply.body, status_code=reply.status, headers=reply.headers)


async def no_stream(member: GraphMember = Depends(require_graph_member)) -> Response:
    """The server answers each POST with JSON and offers no stream or session to end."""
    return Response(status_code=status.HTTP_405_METHOD_NOT_ALLOWED, headers={"Allow": "POST"})


async def server_info(
    username: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> McpServerInfo:
    return await mcp.info(session, graph=graph, username=username)


async def list_served(
    params: ListParams = Depends(list_params(SERVED_LIST)),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ServedPage:
    """Every candidate with its switch; ``f.kind`` narrows to agents or functions."""
    rows = await mcp.served(session, graph=graph)
    kinds = params.filters.get("kind")
    items = [r for r in rows if not kinds or r.kind in kinds]
    return ServedPage(
        items=items,
        total=len(items),
        unfiltered_total=len(rows),
        applied=applied_filters(params, SERVED_LIST),
    )


async def set_served(
    payload: ServedUpdate,
    kind: str = Path(...),
    ref: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    user: User = Depends(get_current_user),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ServedRead:
    return await mcp.set_served(session, graph=graph, kind=kind, ref=ref, served=payload.served, actor=user)


async def list_calls(
    limit: int = Query(20, ge=1, le=100),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> McpCallPage:
    """The newest calls; ``total`` counts every call this Graph has had."""
    items, total = await mcp.calls(session, graph=graph, limit=limit)
    return McpCallPage(items=items, total=total, unfiltered_total=total)
