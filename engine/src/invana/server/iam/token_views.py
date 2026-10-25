"""HTTP handlers for IAM Tokens — parse, call ``IamTokenManager``, serialise.

Every handler is a member's; minting and revoking also need a signed-in
session, so a token cannot mint or revoke a token. Whether the caller holds
iam-admin is read once here and handed to the manager, which owns every rule.
"""

from __future__ import annotations

from fastapi import Depends, Path
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.graphs.roles import GraphRole, holds
from invana.apps.iam.managers.holdings import HoldingsManager
from invana.apps.iam.managers.tokens import IamTokenManager
from invana.apps.iam.schemas import IAM_TOKEN_LIST, IamTokenCreate, IamTokenCreated, IamTokenPage
from invana.core.auth.deps import require_session_auth
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.lists import ListParams, list_params
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

tokens = IamTokenManager()
holdings = HoldingsManager()


async def _is_iam_admin(session: AsyncSession, graph: Graph, user: User) -> bool:
    return holds(await holdings.roles_for(session, graph_id=graph.id, user_id=user.id), GraphRole.iam_admin)


async def list_tokens(
    params: ListParams = Depends(list_params(IAM_TOKEN_LIST)),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> IamTokenPage:
    return await tokens.page(session, graph=graph, params=params)


async def create_token(
    payload: IamTokenCreate,
    member: GraphMember = Depends(require_graph_member),
    user: User = Depends(require_session_auth),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> IamTokenCreated:
    """Mint a token bound to this Graph; the response carries the secret, once."""
    admin = await _is_iam_admin(session, graph, user)
    return await tokens.mint(session, graph=graph, payload=payload, actor=user, actor_is_iam_admin=admin)


async def revoke_token(
    token_id: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    user: User = Depends(require_session_auth),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> None:
    admin = await _is_iam_admin(session, graph, user)
    await tokens.revoke(session, graph=graph, token_id=token_id, actor=user, actor_is_iam_admin=admin)
