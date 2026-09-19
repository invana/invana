"""HTTP views for the agent roster.

Parse, call one manager, serialise (migration-plan §4.1). Retirement, deletion
and lineage go through ``runtime.managers.AgentLifecycleManager`` — they read
`runs`, which an app may not.
"""

from __future__ import annotations

from fastapi import Depends, Path, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.managers import AgentManager
from invana.apps.agents.models import AgentStatus
from invana.apps.agents.schemas import (
    AgentCreate,
    AgentLineageResponse,
    AgentListResponse,
    AgentRead,
    AgentUpdate,
    DefaultAgentRequest,
    RetirePreview,
    RetireRequest,
)
from invana.apps.graphs.models import Graph, GraphMember
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.events.schemas import EventListResponse
from invana.core.events.store import EventFilter, EventStore
from invana.runtime.managers import AgentLifecycleManager
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

agents = AgentManager()
lifecycle = AgentLifecycleManager()


async def list_agents(
    include_ephemeral: bool = Query(default=False, description="Spawned helpers are hidden by default."),
    include_retired: bool = Query(default=False),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> AgentListResponse:
    items = await agents.list_agents(
        session, graph=graph, include_ephemeral=include_ephemeral, include_retired=include_retired
    )
    # The read seeds on first touch, so it commits.
    reads = [AgentRead.model_validate(a) for a in items]
    return AgentListResponse(items=reads, total=len(reads), default_agent_id=graph.default_agent_id)


async def create_agent(
    payload: AgentCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    agent = await agents.create_agent(session, graph=graph, payload=payload, actor=user)
    return AgentRead.model_validate(agent)


async def get_agent(
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    return AgentRead.model_validate(agent)


async def update_agent(
    payload: AgentUpdate,
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    agent = await agents.update_agent(session, agent=agent, payload=payload, actor=user)
    return AgentRead.model_validate(agent)


async def delete_agent(
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    await lifecycle.delete_agent(session, agent=agent, actor=user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def pause_agent(
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    agent = await agents.set_status(session, agent=agent, status=AgentStatus.paused, actor=user)
    return AgentRead.model_validate(agent)


async def resume_agent(
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    agent = await agents.set_status(session, agent=agent, status=AgentStatus.active, actor=user)
    return AgentRead.model_validate(agent)


async def preview_retire(
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> RetirePreview:
    """What retiring would do. The confirm dialog **names the open tasks** —
    a count is not enough to decide with."""
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    return await lifecycle.retire_preview(session, agent=agent)


async def retire_agent(
    payload: RetireRequest | None = None,
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    payload = payload or RetireRequest()
    agent = await agents.retire_agent(
        session,
        agent=agent,
        actor=user,
        reassign_to_kind=payload.reassign_to_kind,
        reassign_to_id=payload.reassign_to_id,
    )
    return AgentRead.model_validate(agent)


async def agent_lineage(
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> AgentLineageResponse:
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    return await lifecycle.lineage(session, agent=agent)


async def agent_activity(
    agent_id: str = Path(...),
    cursor: str | None = Query(default=None),
    page_size: int = Query(default=50, ge=1, le=200),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> EventListResponse:
    """Everything this agent did, newest first — the flat feed filtered to one
    actor, which is the same rows the Events rail shows."""
    await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    return await EventStore().list_page(
        session,
        filters=EventFilter(graph_id=graph.id, actor_id=agent_id, actor_kind="agent"),
        cursor=cursor,
        page_size=page_size,
    )


async def set_default_agent(
    payload: DefaultAgentRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    agent = await agents.get_or_404(session, agent_id=payload.agent_id, graph_id=graph.id)
    await agents.set_default_agent(session, graph=graph, agent=agent, actor=user)
    return AgentRead.model_validate(agent)
