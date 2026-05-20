"""HTTP routes for /api/v1/u/{username}/{slug}/* — graph-scoped surface.

Members + invitations land here in S1.5. Graph CRUD itself (POST /graphs, GET
/graphs, PATCH/DELETE) lands in S2 alongside the setup wizard.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.auth.deps import get_current_user
from invana.auth.models import User
from invana.auth.schemas import (
    GraphMemberOut,
    GraphMemberRoleUpdate,
    InvitationCreateRequest,
    InvitationCreateResponse,
    InvitationOut,
)
from invana.db import get_session
from invana.graphs import services
from invana.graphs.deps import (
    require_graph_admin,
    require_graph_member,
    resolve_graph_by_username_slug,
)
from invana.graphs.models import Graph, GraphMember

# All routes are namespaced /api/v1/u/{username}/{slug}/...
graph_router = APIRouter(prefix="/api/v1/u/{username}/{slug}", tags=["graphs"])


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------


@graph_router.get("/members", response_model=list[GraphMemberOut])
async def list_members(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> list[GraphMemberOut]:
    return await services.list_graph_members(session, graph_id=graph.id)


@graph_router.patch("/members/{user_id}", response_model=GraphMemberOut)
async def update_member_role(
    payload: GraphMemberRoleUpdate,
    user_id: str = Path(...),
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> GraphMemberOut:
    out = await services.update_graph_member_role(
        session,
        graph_id=graph.id,
        target_user_id=user_id,
        payload=payload,
    )
    await session.commit()
    return out


@graph_router.delete("/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    user_id: str = Path(...),
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await services.remove_graph_member(session, graph_id=graph.id, target_user_id=user_id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Invitations
# ---------------------------------------------------------------------------


@graph_router.post("/invitations", response_model=InvitationCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    payload: InvitationCreateRequest,
    _: GraphMember = Depends(require_graph_admin),
    user: User = Depends(get_current_user),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> InvitationCreateResponse:
    out = await services.create_invitation(
        session,
        invited_by=user,
        graph_id=graph.id,
        payload=payload,
    )
    await session.commit()
    return out


@graph_router.get("/invitations", response_model=list[InvitationOut])
async def list_invitations(
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> list[InvitationOut]:
    return await services.list_graph_invitations(session, graph_id=graph.id)


@graph_router.delete("/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invitation(
    invitation_id: str = Path(...),
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await services.delete_invitation(session, graph_id=graph.id, invitation_id=invitation_id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["graph_router"]
