"""FastAPI dependencies for graph-scoped routes.

Resolution chain (per RFC-017):

    resolve_graph_by_username_slug(username, graphSlug)
    └─> get_graph_membership(current_user, graph)
        └─> require_graph_member

Membership is binary (RFC-023): a ``GraphMember`` row == full access. The old
``require_graph_builder`` / ``require_graph_admin`` role tiers were removed.

All graph-scoped URLs are namespaced as ``/api/v1/u/{username}/{graphSlug}/...``.
The path-param is named ``graphSlug`` to disambiguate from the generic word
"slug" elsewhere; the Graph entity's data field is still ``Graph.slug``.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, Path, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.auth.deps import get_current_user
from invana.auth.models import User
from invana.db import get_session
from invana.graphs.models import Graph, GraphMember


def _not_found(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _forbidden(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


async def resolve_graph_by_username_slug(
    username: str = Path(..., description="Owner username from the URL prefix."),
    graphSlug: str = Path(..., description="Graph slug, unique per owner."),
    session: AsyncSession = Depends(get_session),
) -> Graph:
    """Resolve ``/u/{username}/{graphSlug}`` to a Graph row.

    404 if the username doesn't exist, the slug doesn't exist under that owner,
    or the Graph is owned by a different user (per-owner slug uniqueness).
    """
    stmt = (
        select(Graph)
        .join(User, User.id == Graph.created_by_id)
        .where(User.username == username.lower(), Graph.slug == graphSlug.lower())
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
    """Any member of the Graph — the sole graph-scoped access gate (RFC-023)."""
    return member


async def require_graph_setup_complete(
    graph: Graph = Depends(resolve_graph_by_username_slug),
) -> Graph:
    """Gate routes that need the setup wizard's required sections finished.

    Required sections are ``graph_info`` + ``intent`` (see
    ``invana.graphs.schemas.SETUP_REQUIRED``). 409s with the list of incomplete
    sections so the Studio can deep-link the user back to the wizard.
    """
    from invana.graphs.services import is_setup_complete  # avoid import cycle  # noqa: PLC0415

    ok, missing = is_setup_complete(graph)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "graph_setup_incomplete",
                "message": (
                    f"Finish the setup wizard before running queries — incomplete section(s): {', '.join(missing)}."
                ),
                "missing_sections": missing,
                "graph_id": graph.id,
            },
        )
    return graph
