"""FastAPI dependencies for graph-scoped routes.

Resolution chain (per RFC-017):

    resolve_graph_by_username_slug(username, slug)
    └─> get_graph_membership(current_user, graph)
        └─> require_graph_{member,builder,admin}

All graph-scoped URLs are namespaced as ``/api/v1/u/{username}/{slug}/...``.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, Path, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.auth.deps import get_current_user
from invana.auth.models import User
from invana.db import get_session
from invana.graphs.models import Graph, GraphMember, GraphRole


def _not_found(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _forbidden(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


async def resolve_graph_by_username_slug(
    username: str = Path(..., description="Owner username from the URL prefix."),
    slug: str = Path(..., description="Graph slug, unique per owner."),
    session: AsyncSession = Depends(get_session),
) -> Graph:
    """Resolve ``/u/{username}/{slug}`` to a Graph row.

    404 if the username doesn't exist, the slug doesn't exist under that owner,
    or the Graph is owned by a different user (per-owner slug uniqueness).
    """
    stmt = (
        select(Graph)
        .join(User, User.id == Graph.created_by_id)
        .where(User.username == username.lower(), Graph.slug == slug.lower())
    )
    graph = (await session.execute(stmt)).scalar_one_or_none()
    if graph is None:
        raise _not_found("Graph not found.")
    return graph


async def get_graph_membership(
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GraphMember:
    """Resolve the (graph, user) -> GraphMember row or 403."""
    stmt = select(GraphMember).where(
        GraphMember.graph_id == graph.id,
        GraphMember.user_id == user.id,
    )
    member = (await session.execute(stmt)).scalar_one_or_none()
    if member is None:
        raise _forbidden("You are not a member of this Graph.")
    return member


async def require_graph_member(
    member: GraphMember = Depends(get_graph_membership),
) -> GraphMember:
    """Any active member of the Graph."""
    return member


async def require_graph_builder(
    member: GraphMember = Depends(get_graph_membership),
) -> GraphMember:
    """admin or developer within the Graph — gates content mutations."""
    if member.role not in (GraphRole.admin, GraphRole.developer):
        raise _forbidden("This action requires the developer or admin role in this Graph.")
    return member


async def require_graph_admin(
    member: GraphMember = Depends(get_graph_membership),
) -> GraphMember:
    """admin within the Graph — gates invitation / member mgmt and settings."""
    if member.role is not GraphRole.admin:
        raise _forbidden("This action requires the admin role in this Graph.")
    return member
