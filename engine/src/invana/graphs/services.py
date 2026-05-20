"""Business logic for graph-scoped endpoints — members + invitations.

Functions flush but do not commit — the route handler commits at end-of-request.
"""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from invana.auth.models import User
from invana.auth.schemas import (
    GraphMemberOut,
    GraphMemberRoleUpdate,
    InvitationCreateRequest,
    InvitationCreateResponse,
    InvitationOut,
)
from invana.auth.services import (
    invitation_token_hash,
    make_invitation_expiry,
    new_invitation_raw_token,
    studio_redeem_url,
)
from invana.graphs.models import GraphMember, GraphRole, Invitation

# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------


async def list_graph_members(session: AsyncSession, *, graph_id: str) -> list[GraphMemberOut]:
    stmt = (
        select(GraphMember)
        .where(GraphMember.graph_id == graph_id)
        .options(selectinload(GraphMember.user))
        .order_by(GraphMember.created_at.asc())
    )
    return [
        GraphMemberOut(
            user_id=m.user_id,
            username=m.user.username,
            email=m.user.email,
            first_name=m.user.first_name,
            last_name=m.user.last_name,
            role=m.role,
            created_at=m.created_at,
        )
        for m in (await session.execute(stmt)).scalars().all()
    ]


async def update_graph_member_role(
    session: AsyncSession,
    *,
    graph_id: str,
    target_user_id: str,
    payload: GraphMemberRoleUpdate,
) -> GraphMemberOut:
    member = await _get_membership(session, graph_id=graph_id, user_id=target_user_id)
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Member not found.")
    if (
        member.role is GraphRole.admin
        and payload.role is not GraphRole.admin
        and await _is_sole_graph_admin(session, graph_id=graph_id, user_id=target_user_id)
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Cannot demote the only admin of this Graph.",
        )
    member.role = payload.role
    await session.flush()
    await session.refresh(member, ["user"])
    return GraphMemberOut(
        user_id=member.user_id,
        username=member.user.username,
        email=member.user.email,
        first_name=member.user.first_name,
        last_name=member.user.last_name,
        role=member.role,
        created_at=member.created_at,
    )


async def remove_graph_member(session: AsyncSession, *, graph_id: str, target_user_id: str) -> None:
    member = await _get_membership(session, graph_id=graph_id, user_id=target_user_id)
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Member not found.")
    if member.role is GraphRole.admin and await _is_sole_graph_admin(
        session, graph_id=graph_id, user_id=target_user_id
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Cannot remove the only admin of this Graph.",
        )
    await session.delete(member)


async def _is_sole_graph_admin(session: AsyncSession, *, graph_id: str, user_id: str) -> bool:
    stmt = select(func.count()).where(
        GraphMember.graph_id == graph_id,
        GraphMember.role == GraphRole.admin,
        GraphMember.user_id != user_id,
    )
    return (await session.execute(stmt)).scalar_one() == 0


# ---------------------------------------------------------------------------
# Invitations
# ---------------------------------------------------------------------------


async def create_invitation(
    session: AsyncSession,
    *,
    invited_by: User,
    graph_id: str,
    payload: InvitationCreateRequest,
) -> InvitationCreateResponse:
    raw_token = new_invitation_raw_token()
    invitation = Invitation(
        token_hash=invitation_token_hash(raw_token),
        email=payload.email.lower(),
        graph_id=graph_id,
        role=payload.role,
        invited_by_id=invited_by.id,
        expires_at=make_invitation_expiry(),
    )
    session.add(invitation)
    await session.flush()

    return InvitationCreateResponse(
        id=invitation.id,
        email=invitation.email,
        graph_id=invitation.graph_id,
        role=invitation.role,
        invited_by_id=invitation.invited_by_id,
        expires_at=invitation.expires_at,
        accepted_at=invitation.accepted_at,
        created_at=invitation.created_at,
        redeem_url=studio_redeem_url(raw_token),
    )


async def list_graph_invitations(session: AsyncSession, *, graph_id: str) -> list[InvitationOut]:
    stmt = select(Invitation).where(Invitation.graph_id == graph_id).order_by(Invitation.created_at.desc())
    return [InvitationOut.model_validate(r) for r in (await session.execute(stmt)).scalars().all()]


async def delete_invitation(session: AsyncSession, *, graph_id: str, invitation_id: str) -> None:
    invitation = await session.get(Invitation, invitation_id)
    if invitation is None or invitation.graph_id != graph_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invitation not found.")
    await session.delete(invitation)


# ---------------------------------------------------------------------------
# Lookups
# ---------------------------------------------------------------------------


async def _get_membership(session: AsyncSession, *, graph_id: str, user_id: str) -> GraphMember | None:
    stmt = select(GraphMember).where(
        GraphMember.graph_id == graph_id,
        GraphMember.user_id == user_id,
    )
    return (await session.execute(stmt)).scalar_one_or_none()
