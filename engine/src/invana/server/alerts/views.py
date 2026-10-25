"""HTTP views for alert rules (docs/for-developers/modules/operate/features/approvals.md).

Parse, call one manager, serialise. Reading the rules is open to every member;
writing one is the Graph's ``settings`` area (owner), enforced by the guard off
the matched route.
"""

from __future__ import annotations

from fastapi import Depends, Path, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers.alerts import AlertRuleManager
from invana.activity.schemas import AlertRuleCreate, AlertRuleRead, AlertRuleUpdate
from invana.apps.graphs.models import Graph, GraphMember
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

_rules = AlertRuleManager()


async def list_rules(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> list[AlertRuleRead]:
    return await _rules.list(session, graph=graph)


async def create_rule(
    payload: AlertRuleCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AlertRuleRead:
    row = await _rules.create(session, graph=graph, payload=payload, actor_id=user.id)
    return await _rules.read(session, row)


async def update_rule(
    payload: AlertRuleUpdate,
    rule_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AlertRuleRead:
    row = await _rules.update(session, graph=graph, rule_id=rule_id, payload=payload, actor_id=user.id)
    return await _rules.read(session, row)


async def delete_rule(
    rule_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await _rules.delete(session, graph=graph, rule_id=rule_id, actor_id=user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
