"""Groups — people and agents of one Graph that hold policies together.

docs/for-developers/modules/identity-and-access/features/people-and-groups.md.
A group's policies, managed ones included, pass to every member at check time;
nothing is copied. A person added must be a member of the Graph and an agent
must be the Graph's. Deleting a group deletes what it holds; its members keep
their own. Every change is an event::

    groups = GroupManager()
    group = await groups.create(session, graph_id=g, payload=GroupCreate(name="fare-team"), actor_id=me)
    await groups.add_member(session, graph_id=g, name="fare-team", payload=GroupMemberAdd(...), actor_id=me)

Who may call a write is the route's guard (the ``iam`` area).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.iam.models import Group, GroupMember
from invana.apps.iam.querysets.groups import GroupQuerySet
from invana.apps.iam.querysets.people import PeopleQuerySet
from invana.apps.iam.querysets.policies import PolicyQuerySet
from invana.apps.iam.schemas import GroupCreate, GroupMemberAdd, GroupMemberRef, GroupRead, GroupRow, GroupUpdate
from invana.core.errors import ConflictError, NotFoundError
from invana.core.events import actions
from invana.core.events.services import emit_event
from invana.core.lists import ListParams, PageInfo


class GroupManager:
    """Stateless. The session is the first argument of every method."""

    qs = GroupQuerySet()
    policies_qs = PolicyQuerySet()
    people_qs = PeopleQuerySet()

    async def page(
        self, session: AsyncSession, *, graph_id: str, params: ListParams
    ) -> tuple[list[GroupRow], PageInfo]:
        rows, info = await self.qs.page(session, graph_id=graph_id, params=params)
        reads = await self._reads(session, graph_id=graph_id, groups=list(rows))
        return [GroupRow(**r.model_dump(exclude={"members"})) for r in reads], info

    async def get_row(self, session: AsyncSession, *, graph_id: str, name: str) -> Group:
        group = await self.qs.get_by_name(session, graph_id=graph_id, name=name)
        if group is None:
            raise NotFoundError(f"No group {name!r} in this Graph.")
        return group

    async def get(self, session: AsyncSession, *, graph_id: str, name: str) -> GroupRead:
        group = await self.get_row(session, graph_id=graph_id, name=name)
        return (await self._reads(session, graph_id=graph_id, groups=[group]))[0]

    async def _reads(self, session: AsyncSession, *, graph_id: str, groups: list[Group]) -> list[GroupRead]:
        members = await self.qs.members_of(session, group_ids=[g.id for g in groups])
        users = await self.people_qs.usernames(session, ids=[m.member_id for m in members if m.member_kind == "person"])
        agents = await self.policies_qs.agent_names(session, graph_id=graph_id)
        attachments = await self.policies_qs.attachments(session, graph_id=graph_id, now=datetime.now(UTC))
        held = [a for a in attachments if a.holder_kind == "group"]
        policies = await self.policies_qs.by_ids(session, ids=list({a.policy_id for a in held}))
        out: list[GroupRead] = []
        for g in groups:
            refs = [
                GroupMemberRef(
                    id=m.id,
                    member_kind=m.member_kind,
                    member_id=m.member_id,
                    name=(users if m.member_kind == "person" else agents).get(m.member_id, m.member_id),
                )
                for m in members
                if m.group_id == g.id
            ]
            people = [r.name for r in refs if r.member_kind == "person"]
            agent_names = [r.name for r in refs if r.member_kind == "agent"]
            out.append(
                GroupRead(
                    id=g.id,
                    name=g.name,
                    description=g.description,
                    people=people,
                    agents=agent_names,
                    policies=sorted(policies[a.policy_id].name for a in held if a.holder_id == g.id),
                    people_count=len(people),
                    agents_count=len(agent_names),
                    members=refs,
                )
            )
        return out

    async def create(self, session: AsyncSession, *, graph_id: str, payload: GroupCreate, actor_id: str) -> GroupRead:
        if await self.qs.get_by_name(session, graph_id=graph_id, name=payload.name) is not None:
            raise ConflictError(f"A group named {payload.name} already exists in this Graph.")
        group = Group(graph_id=graph_id, name=payload.name, description=payload.description, created_by_id=actor_id)
        await self.qs.add(session, group)
        await self._emit(session, actions.GROUP_CREATE, group, actor_id, {})
        return await self.get(session, graph_id=graph_id, name=group.name)

    async def update(
        self, session: AsyncSession, *, graph_id: str, name: str, payload: GroupUpdate, actor_id: str
    ) -> GroupRead:
        group = await self.get_row(session, graph_id=graph_id, name=name)
        if payload.description is not None and payload.description != group.description:
            group.description = payload.description
            await session.flush()
            await self._emit(session, actions.GROUP_UPDATE, group, actor_id, {})
        return await self.get(session, graph_id=graph_id, name=name)

    async def delete(self, session: AsyncSession, *, graph_id: str, name: str, actor_id: str) -> None:
        group = await self.get_row(session, graph_id=graph_id, name=name)
        await self._emit(session, actions.GROUP_DELETE, group, actor_id, {})
        await self.qs.delete(session, group)

    async def add_member(
        self, session: AsyncSession, *, graph_id: str, name: str, payload: GroupMemberAdd, actor_id: str
    ) -> GroupRead:
        """Add a member of the Graph, or one of its agents, to the group."""
        group = await self.get_row(session, graph_id=graph_id, name=name)
        if payload.member_kind == "person":
            if await self.people_qs.member(session, graph_id=graph_id, user_id=payload.member_id) is None:
                raise NotFoundError("That person is not a member of this Graph.")
        elif payload.member_id not in await self.policies_qs.agent_names(session, graph_id=graph_id):
            raise NotFoundError("No such agent in this Graph.")
        if await self.qs.member_by_ref(
            session, group_id=group.id, member_kind=payload.member_kind, member_id=payload.member_id
        ):
            raise ConflictError(f"That {payload.member_kind} is already in {group.name}.")
        row = GroupMember(
            group_id=group.id, member_kind=payload.member_kind, member_id=payload.member_id, added_by_id=actor_id
        )
        await self.qs.add(session, row)
        await self._emit(
            session,
            actions.GROUP_MEMBER_ADD,
            group,
            actor_id,
            {"member_kind": row.member_kind, "member_id": row.member_id},
        )
        return await self.get(session, graph_id=graph_id, name=name)

    async def remove_member(
        self, session: AsyncSession, *, graph_id: str, name: str, member_id: str, actor_id: str
    ) -> GroupRead:
        """Remove one membership row (``GroupMemberRef.id``) from the group."""
        group = await self.get_row(session, graph_id=graph_id, name=name)
        row = await self.qs.member(session, group_id=group.id, member_id=member_id)
        if row is None:
            raise NotFoundError(f"No such member of {group.name}.")
        await self._emit(
            session,
            actions.GROUP_MEMBER_REMOVE,
            group,
            actor_id,
            {"member_kind": row.member_kind, "member_id": row.member_id},
        )
        await self.qs.remove_member(session, row)
        return await self.get(session, graph_id=graph_id, name=name)

    async def _emit(
        self, session: AsyncSession, action: str, group: Group, actor_id: str, details: dict[str, Any]
    ) -> None:
        await emit_event(
            session,
            action=action,
            target_kind=actions.TARGET_GROUP,
            target_id=group.id,
            graph_id=group.graph_id,
            actor_id=actor_id,
            details={"name": group.name, **details},
        )
