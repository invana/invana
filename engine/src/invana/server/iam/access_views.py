"""HTTP views for IAM's runtime reads — overview, agents' effective access, Test access, impact, limits.

docs/for-developers/modules/identity-and-access/features/effective-access.md ·
features/policies.md · features/the-iam-product.md. Parse, call
:class:`~invana.runtime.managers.access.AccessReadManager`, serialise. Every
route is a read open to every member of the Graph; none writes.
"""

from __future__ import annotations

from fastapi import Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.iam.schemas import (
    AGENT_ACCESS_LIST,
    AccessCheckRead,
    AccessCheckRequest,
    AgentAccessPage,
    EffectiveRead,
    ImpactRead,
    ImpactRequest,
    LimitsRead,
    OverviewRead,
)
from invana.core.db import get_session
from invana.core.ledger.schemas import LedgerRowRead
from invana.core.lists import ListParams, Page, list_params
from invana.runtime.managers.access import REFUSAL_LIST, AccessReadManager
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

_reads = AccessReadManager()


async def get_overview(
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> OverviewRead:
    return await _reads.overview(session, graph=graph)


async def list_agents(
    params: ListParams = Depends(list_params(AGENT_ACCESS_LIST)),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> AgentAccessPage:
    return await _reads.agents(session, graph=graph, params=params)


async def get_effective(
    agent_id: str = Path(...),
    started_by: str | None = Query(None, description="A user id or username"),
    run_id: str | None = Query(None),
    world_id: str | None = Query(None),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> EffectiveRead:
    return await _reads.effective(
        session, graph=graph, agent_id=agent_id, started_by=started_by, run_id=run_id, world_id=world_id
    )


async def list_refusals(
    agent_id: str = Path(...),
    params: ListParams = Depends(list_params(REFUSAL_LIST)),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> Page[LedgerRowRead]:
    return await _reads.refusals(session, graph=graph, agent_id=agent_id, params=params)


async def test_access(
    payload: AccessCheckRequest,
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> AccessCheckRead:
    return await _reads.test(session, graph=graph, request=payload)


async def policy_impact(
    payload: ImpactRequest,
    name: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ImpactRead:
    return await _reads.impact(session, graph=graph, name=name, request=payload)


async def policy_limits(
    name: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LimitsRead:
    return await _reads.limit_usage(session, graph=graph, name=name)
