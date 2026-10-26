"""HTTP views for requests (docs/for-developers/modules/govern/features/requests.md).

Parse, call one manager, serialise. Every member reads the inbox and may ask for
a change; resolving needs the modeller role, enforced by the guard off the
matched route and again by the manager. An agent's name is resolved here,
because ``agents`` sits above Govern.
"""

from __future__ import annotations

from fastapi import Depends, Path
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.querysets.agent import AgentQuerySet
from invana.apps.govern.managers import RequestManager
from invana.apps.govern.models import Request
from invana.apps.govern.schemas import REQUEST_LIST, RequestCreate, RequestPage, RequestRead, RequestResolve
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.graphs.roles import GraphRole
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.lists import ListParams, applied_filters, list_params
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

_requests = RequestManager()
_agents = AgentQuerySet()


async def _agent_names(session: AsyncSession, rows: list[Request]) -> dict[str, str]:
    return await _agents.names_by_ids(session, sorted({r.agent_id for r in rows if r.agent_id}))


async def list_requests(
    params: ListParams = Depends(list_params(REQUEST_LIST)),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> RequestPage:
    """The inbox, newest ask first, with the Graph's open count whatever the filter."""

    async def names(rows: list[Request]) -> dict[str, str]:
        return await _agent_names(session, rows)

    return await _requests.page(
        session,
        graph_id=graph.id,
        params=params,
        applied=applied_filters(params, REQUEST_LIST),
        agent_names=names,
        may_resolve=member.holds(GraphRole.modeller),
    )


async def get_request(
    request_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> RequestRead:
    row = await _requests.get(session, graph_id=graph.id, request_id=request_id)
    return await _requests.read(session, row, agent_names=await _agent_names(session, [row]))


async def create_request(
    payload: RequestCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RequestRead:
    """*Ask for a change* — a ``change`` request by the caller, merged into the open one it repeats."""
    row = await _requests.ask(session, graph_id=graph.id, payload=payload, actor_id=user.id)
    return await _requests.read(session, row, agent_names={})


async def resolve_request(
    payload: RequestResolve,
    request_id: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RequestRead:
    row = await _requests.resolve(
        session,
        request=await _requests.get(session, graph_id=graph.id, request_id=request_id),
        payload=payload,
        actor_id=user.id,
        may_resolve=member.holds(GraphRole.modeller),
    )
    return await _requests.read(session, row, agent_names=await _agent_names(session, [row]))
