"""HTTP views for the inbox, notification rules and channels
(docs/for-developers/modules/operate/features/notifications.md).

Parse, call one manager, serialise. Rules and channels are the ``settings`` area
(owner), enforced by the guard; reading them and one's own inbox is open to
every member, and marking one's own notifications read is ``ask``.
"""

from __future__ import annotations

from fastapi import Depends, Path, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers import ChannelManager, InboxManager, NotificationRuleManager
from invana.activity.schemas import (
    ChannelCreate,
    ChannelListResponse,
    ChannelRead,
    InboxResponse,
    MarkRead,
    MarkReadResponse,
    NotificationRuleListResponse,
    NotificationRuleRead,
    NotificationRuleUpdate,
    NotificationRuleWrite,
)
from invana.apps.graphs.models import Graph, GraphMember
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

_inbox = InboxManager()
_rules = NotificationRuleManager()
_channels = ChannelManager()


async def get_inbox(
    unread: bool = Query(False, description="Only what is unread."),
    limit: int = Query(50, ge=1, le=200),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> InboxResponse:
    return await _inbox.inbox(session, graph=graph, user=user, unread=unread, limit=limit)


async def mark_read(
    payload: MarkRead,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MarkReadResponse:
    return MarkReadResponse(marked=await _inbox.mark_read(session, graph=graph, user=user, ids=payload.ids))


async def list_rules(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> NotificationRuleListResponse:
    rows = await _rules.list(session, graph=graph)
    return NotificationRuleListResponse(items=[_rules.read(r) for r in rows], total=len(rows))


async def create_rule(
    payload: NotificationRuleWrite,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> NotificationRuleRead:
    return _rules.read(await _rules.create(session, graph=graph, payload=payload, actor_id=user.id))


async def get_rule(
    rule_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> NotificationRuleRead:
    return _rules.read(await _rules.get(session, graph=graph, rule_id=rule_id))


async def update_rule(
    payload: NotificationRuleUpdate,
    rule_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> NotificationRuleRead:
    return _rules.read(await _rules.update(session, graph=graph, rule_id=rule_id, payload=payload, actor_id=user.id))


async def delete_rule(
    rule_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await _rules.delete(session, graph=graph, rule_id=rule_id, actor_id=user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def list_channels(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ChannelListResponse:
    rows = await _channels.list(session, graph=graph)
    return ChannelListResponse(items=[_channels.read(r) for r in rows], total=len(rows))


async def create_channel(
    payload: ChannelCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ChannelRead:
    return _channels.read(await _channels.create(session, graph=graph, payload=payload, actor_id=user.id))


async def delete_channel(
    channel_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await _channels.delete(session, graph=graph, ref=channel_id, actor_id=user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
