"""HTTP views for a Graph's members, their Graph roles, and the caller's access.

Parse, call one manager, serialise. Who may change members is the guard's
(``members`` is the ``settings`` area, an owner's); reading the list and one's
own access is open to every member
(docs/for-developers/modules/identity-and-access/features/roles.md).
"""

from __future__ import annotations

from fastapi import Depends, Path, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.managers import GraphMemberManager
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.graphs.schemas import AccessRead, MemberAdd, MemberListResponse, MemberRead, MemberUpdate
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

_members = GraphMemberManager()


async def list_members(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> MemberListResponse:
    items = await _members.members(session, graph=graph)
    return MemberListResponse(items=items, total=len(items))


async def add_member(
    payload: MemberAdd,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MemberRead:
    row = await _members.add(session, graph=graph, identifier=payload.user, roles=payload.roles, actor_id=user.id)
    return _members.read(row)


async def update_member(
    payload: MemberUpdate,
    member: str = Path(..., description="The member's username."),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MemberRead:
    row = await _members.set_roles(session, graph=graph, username=member, roles=payload.roles, actor_id=user.id)
    return _members.read(row)


async def remove_member(
    member: str = Path(..., description="The member's username."),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await _members.remove(session, graph=graph, username=member, actor_id=user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def get_access(
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> AccessRead:
    return await _members.access(session, graph=graph, member=member)
