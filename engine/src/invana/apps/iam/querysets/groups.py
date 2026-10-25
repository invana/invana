"""Queries against ``groups`` and ``group_members``."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.iam.models import Group, GroupMember, PolicyAttachment
from invana.core.lists import ListParams, PageInfo
from invana.core.lists.querysets import contains, page_of_select


class GroupQuerySet:
    async def page(
        self, session: AsyncSession, *, graph_id: str, params: ListParams
    ) -> tuple[Sequence[Group], PageInfo]:
        unfiltered = select(Group).where(Group.graph_id == graph_id)
        stmt = unfiltered
        if params.q:
            stmt = stmt.where(contains(params.q, Group.name, Group.description))
        return await page_of_select(
            session, stmt, params, unfiltered=unfiltered, sorts={"name": Group.name}, id_column=Group.id
        )

    async def get_by_name(self, session: AsyncSession, *, graph_id: str, name: str) -> Group | None:
        stmt = select(Group).where(Group.graph_id == graph_id, Group.name == name)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def get(self, session: AsyncSession, *, graph_id: str, group_id: str) -> Group | None:
        stmt = select(Group).where(Group.graph_id == graph_id, Group.id == group_id)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def members_of(self, session: AsyncSession, *, group_ids: Sequence[str]) -> list[GroupMember]:
        if not group_ids:
            return []
        stmt = select(GroupMember).where(GroupMember.group_id.in_(list(group_ids))).order_by(GroupMember.added_at)
        return list((await session.execute(stmt)).scalars().all())

    async def member(self, session: AsyncSession, *, group_id: str, member_id: str) -> GroupMember | None:
        stmt = select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.id == member_id)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def member_by_ref(
        self, session: AsyncSession, *, group_id: str, member_kind: str, member_id: str
    ) -> GroupMember | None:
        stmt = select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.member_kind == member_kind,
            GroupMember.member_id == member_id,
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def add(self, session: AsyncSession, row: Group | GroupMember) -> None:
        session.add(row)
        await session.flush()

    async def remove_member(self, session: AsyncSession, row: GroupMember) -> None:
        await session.delete(row)
        await session.flush()

    async def delete(self, session: AsyncSession, group: Group) -> None:
        """The group, its members and what it holds."""
        await session.execute(
            delete(PolicyAttachment).where(
                PolicyAttachment.graph_id == group.graph_id,
                PolicyAttachment.holder_kind == "group",
                PolicyAttachment.holder_id == group.id,
            )
        )
        await session.execute(delete(GroupMember).where(GroupMember.group_id == group.id))
        await session.delete(group)
        await session.flush()
