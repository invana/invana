"""Queries behind who holds which policy — attachments, groups and roles.

The reads every access check makes, so each is one statement: the policies a
principal holds directly, through its groups, and (for a person) as the managed
policies its membership names.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import GraphMember
from invana.apps.iam.models import Group, GroupMember, Policy, PolicyAttachment, PolicyKind, PolicyStatus


class HoldingsQuerySet:
    async def group_ids_of(self, session: AsyncSession, *, graph_id: str, kind: str, member_id: str) -> list[str]:
        """The groups of this Graph a person or an agent is in."""
        stmt = (
            select(GroupMember.group_id)
            .join(Group, Group.id == GroupMember.group_id)
            .where(Group.graph_id == graph_id, GroupMember.member_kind == kind, GroupMember.member_id == member_id)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def attached(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        holders: Sequence[tuple[str, str]],
        now: datetime,
        run_id: str | None = None,
    ) -> list[tuple[Policy, PolicyAttachment]]:
        """Saved policies attached to any of ``holders`` and not ended.

        An attachment made for a run counts only for that run.
        """
        if not holders:
            return []
        who = or_(*[and_(PolicyAttachment.holder_kind == k, PolicyAttachment.holder_id == i) for k, i in holders])
        stmt = (
            select(Policy, PolicyAttachment)
            .join(PolicyAttachment, PolicyAttachment.policy_id == Policy.id)
            .where(
                PolicyAttachment.graph_id == graph_id,
                Policy.status == PolicyStatus.saved.value,
                who,
                or_(PolicyAttachment.ends_at.is_(None), PolicyAttachment.ends_at > now),
                or_(PolicyAttachment.run_id.is_(None), PolicyAttachment.run_id == (run_id or "")),
            )
        )
        return [(p, a) for p, a in (await session.execute(stmt)).all()]

    async def managed_by_name(self, session: AsyncSession, *, graph_id: str, names: Sequence[str]) -> list[Policy]:
        if not names:
            return []
        stmt = select(Policy).where(
            Policy.graph_id == graph_id, Policy.kind == PolicyKind.managed.value, Policy.name.in_(list(names))
        )
        return list((await session.execute(stmt)).scalars().all())

    async def boundaries(self, session: AsyncSession, *, graph_id: str) -> list[Policy]:
        stmt = select(Policy).where(
            Policy.graph_id == graph_id,
            Policy.kind == PolicyKind.boundary.value,
            Policy.status == PolicyStatus.saved.value,
        )
        return list((await session.execute(stmt.order_by(Policy.name))).scalars().all())

    async def member_roles(self, session: AsyncSession, *, graph_id: str, user_id: str) -> list[str] | None:
        """A person's directly held roles, or ``None`` when they are not a member."""
        stmt = select(GraphMember.roles).where(GraphMember.graph_id == graph_id, GraphMember.user_id == user_id)
        row = (await session.execute(stmt)).first()
        return list(row[0] or []) if row is not None else None
