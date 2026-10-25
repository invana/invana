"""FastAPI dependencies for graph-scoped routes.

Band 5: these resolve a Graph from the URL, check membership and hold the setup
gates. A dependency needs a request, so it is edge code — and having it here is
what lets it reach `apps/setup` without `apps/graphs` doing so (§14.1).

FastAPI dependencies for graph-scoped routes.

Resolution chain (per docs/for-developers/modules/identity-and-access/spec.md):

    resolve_graph_by_username_slug(username, graphSlug)
    └─> get_graph_membership(current_user, graph)
        └─> require_graph_member

A ``GraphMember`` row is the right to read the Graph; its ``roles``, with the
managed policies its groups hold, are the right to change it
(docs/for-developers/modules/identity-and-access/features/roles.md).
``require_graph_member`` checks both, from one policy table, on every route.

All graph-scoped URLs are namespaced as ``/api/v1/u/{username}/{graphSlug}/...``.
The path-param is named ``graphSlug`` to disambiguate from the generic word
"slug" elsewhere; the Graph entity's data field is still ``Graph.slug``.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, Path, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.managers import GraphMemberManager
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.graphs.roles import READ_METHODS, GraphRole, area_for, holds
from invana.apps.iam.managers import HoldingsManager
from invana.apps.setup.managers import SetupManager
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.telemetry.spans import set_current
from invana.runtime.querysets import TaskRunQuerySet


def _not_found(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _forbidden(detail: str | dict) -> HTTPException:
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
    # The Graph in the same `user/graph` form Studio records on its action spans.
    set_current(**{"invana.graph": f"{username.lower()}/{graph.slug}", "invana.graph_id": graph.id})
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
    request: Request,
    graph: Graph = Depends(resolve_graph_by_username_slug),
    member: GraphMember = Depends(get_graph_membership),
    session: AsyncSession = Depends(get_session),
) -> GraphMember:
    """A member of the Graph holding the role the request's area needs — the one
    graph-scoped access gate (docs/for-developers/modules/identity-and-access/features/roles.md).

    Reads are open to every member. A write's area is read off the route the
    request matched (``apps/graphs/roles.area_for``), so no route names its own
    role; a write the policy does not name needs ``owner``. A refusal is 403
    ``role_required`` naming the area, the role and who holds it.
    """
    route = request.scope.get("route")
    path = getattr(route, "path", request.url.path)
    if request.method.upper() in READ_METHODS:
        return member
    area = area_for(request.method, path)
    role = area.role if area is not None else GraphRole.owner
    if member.holds(role):
        return member
    # A role a group holds counts as the member's own.
    if holds(await HoldingsManager().roles_for(session, graph_id=graph.id, user_id=member.user_id), role):
        return member
    holders = await GraphMemberManager().holders(session, graph_id=graph.id, role=role)
    label = area.label if area is not None else "This change"
    raise _forbidden(
        {
            "error": "role_required",
            "area": area.name if area is not None else None,
            "role": role.value,
            "holders": holders,
            "message": f"{label} needs the {role.value} role on this Graph. "
            + (f"Ask {', '.join(holders)}." if holders else "Ask an owner."),
        }
    )


def require_graph_gate(gate: str):
    """Gate routes on **one** setup gate — ``connected`` · ``grounded`` ·
    ``answering`` (docs/for-developers/modules/platform/features/setup.md §2).

    A surface waits on what it actually needs, not on the whole sequence (SU3):
    authoring a model needs a database, and nothing about an LLM provider. 409s
    with the sections the gate is still missing, so Studio can send the user to
    the step that opens it rather than to "setup" in general.
    """

    async def dependency(
        graph: Graph = Depends(resolve_graph_by_username_slug),
        session: AsyncSession = Depends(get_session),
    ) -> Graph:
        open_, missing = await SetupManager(TaskRunQuerySet()).is_gate_open(session, graph, gate)
        if not open_:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "graph_setup_incomplete",
                    "message": f"This graph is not {gate} yet — it still needs: {', '.join(missing)}.",
                    "gate": gate,
                    "missing_sections": missing,
                    "graph_id": graph.id,
                },
            )
        return graph

    return dependency


# The three gates, as dependencies. Bound once at import so a route — and a test
# that overrides one — names the same object every time; ``require_graph_gate``
# builds a new function on each call.
require_graph_connected = require_graph_gate("connected")
require_graph_grounded = require_graph_gate("grounded")
require_graph_answering = require_graph_gate("answering")
