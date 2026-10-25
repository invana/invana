"""Members of a Graph and the Graph roles they hold.

docs/for-developers/modules/identity-and-access/features/membership.md ·
features/roles.md. The rules every front-end shares:

- a member is added by email or username, and must already have an account;
- a role set is normalised (``apps/graphs/roles.normalise``) — unknown names are
  refused, an empty set is ``viewer``;
- a Graph always has an owner and an iam-admin, so removing or demoting the
  last of either is refused;
- a member's roles are their own and the managed policies their groups hold,
  unioned — ``holders`` and ``access`` read both;
- removing a member takes their group memberships and the policies attached to
  them in this Graph with them;
- every change is an event (``member.add · remove · roles``).

Used by the routes and by ``invana members``::

    members = GraphMemberManager()
    await members.add(session, graph=graph, identifier="ada@lab.org", roles=["modeller"], actor=owner)
    await members.set_roles(session, graph=graph, username="ada", roles=["builder"], actor=owner)
    access = await members.access(session, graph=graph, member=me)

Who may call these is the route's guard (``members`` is the ``iam`` area, an
iam-admin's); the manager does not re-check the actor's role.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.graphs.querysets import GraphMemberQuerySet
from invana.apps.graphs.querysets.group_roles import GroupRoleQuerySet
from invana.apps.graphs.roles import AREAS, GraphRole, holds, normalise
from invana.apps.graphs.schemas import AccessArea, AccessRead, MemberRead
from invana.core.auth.managers import AuthManager
from invana.core.errors import ConflictError, NotFoundError, ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event
from invana.core.lists import ListParams, PageInfo


def _roles(raw: list[str]) -> list[str]:
    try:
        return normalise(raw)
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc


class GraphMemberManager:
    members_qs = GraphMemberQuerySet()
    group_roles_qs = GroupRoleQuerySet()
    auth = AuthManager()

    async def members(self, session: AsyncSession, *, graph: Graph) -> list[MemberRead]:
        rows = await self.members_qs.list_for_graph(session, graph_id=graph.id)
        return [self.read(row) for row in rows]

    async def page(
        self, session: AsyncSession, *, graph: Graph, params: ListParams
    ) -> tuple[list[MemberRead], PageInfo]:
        """One page of the Members list, searched, filtered and sorted by ``params``."""
        rows, info = await self.members_qs.page_for_graph(session, graph_id=graph.id, params=params)
        return [self.read(row) for row in rows], info

    @staticmethod
    def read(row: GraphMember) -> MemberRead:
        return MemberRead(
            user_id=str(row.user_id),
            username=row.user.username,
            first_name=row.user.first_name,
            last_name=row.user.last_name,
            roles=list(row.roles or [GraphRole.viewer.value]),
            added_at=row.created_at,
        )

    async def get(self, session: AsyncSession, *, graph: Graph, username: str) -> GraphMember:
        row = await self.members_qs.get_by_username(session, graph_id=graph.id, username=username)
        if row is None:
            raise NotFoundError(f"{username!r} is not a member of this Graph.")
        return row

    async def add(
        self, session: AsyncSession, *, graph: Graph, identifier: str, roles: list[str], actor_id: str
    ) -> GraphMember:
        """Add an existing account as a member with ``roles``."""
        stored = _roles(roles)
        user = await self.auth.find_user_by_email_or_username(session, identifier=identifier.strip())
        if user is None or not user.is_active:
            raise NotFoundError(f"No account {identifier!r}. A member must already have an account.")
        if await self.members_qs.get(session, graph_id=graph.id, user_id=user.id) is not None:
            raise ConflictError(f"{user.username} is already a member; change their roles instead.")
        row = GraphMember(graph_id=graph.id, user_id=user.id, roles=stored)
        session.add(row)
        await session.flush()
        await session.refresh(row, attribute_names=["user"])
        await self._emit(session, actions.MEMBER_ADD, graph, row, actor_id)
        return row

    async def set_roles(
        self, session: AsyncSession, *, graph: Graph, username: str, roles: list[str], actor_id: str
    ) -> GraphMember:
        """Replace a member's roles. Demoting the last owner is refused."""
        stored = _roles(roles)
        row = await self.get(session, graph=graph, username=username)
        if row.holds(GraphRole.owner) and GraphRole.owner.value not in stored:
            await self._keep_an_owner(session, graph, row)
        if GraphRole.iam_admin.value in (row.roles or []) and GraphRole.iam_admin.value not in stored:
            await self._keep_an_iam_admin(session, graph, row, stays=True)
        if stored != list(row.roles or []):
            row.roles = stored
            await session.flush()
            await self._emit(session, actions.MEMBER_ROLES, graph, row, actor_id)
        return row

    async def remove(self, session: AsyncSession, *, graph: Graph, username: str, actor_id: str) -> None:
        """Remove a membership. Their work and authorship stay; the last owner stays."""
        row = await self.get(session, graph=graph, username=username)
        if row.holds(GraphRole.owner):
            await self._keep_an_owner(session, graph, row)
        if GraphRole.iam_admin.value in (row.roles or []):
            await self._keep_an_iam_admin(session, graph, row, stays=False)
        await self._emit(session, actions.MEMBER_REMOVE, graph, row, actor_id)
        await self.group_roles_qs.forget_person(session, graph_id=graph.id, user_id=row.user_id)
        await session.delete(row)
        await session.flush()

    async def effective(self, session: AsyncSession, *, graph_id: str) -> list[tuple[GraphMember, list[str]]]:
        """Every member with their roles — their own and their groups', as a stored role set."""
        rows = await self.members_qs.list_for_graph(session, graph_id=graph_id)
        via_groups = await self.group_roles_qs.group_roles(session, graph_id=graph_id, now=datetime.now(UTC))
        return [(row, normalise([*(row.roles or []), *via_groups.get(row.user_id, ())])) for row in rows]

    async def holders(self, session: AsyncSession, *, graph_id: str, role: GraphRole) -> list[str]:
        """Usernames that may act as ``role`` — owners and group holders included."""
        return [
            row.user.username for row, roles in await self.effective(session, graph_id=graph_id) if holds(roles, role)
        ]

    async def access(self, session: AsyncSession, *, graph: Graph, member: GraphMember) -> AccessRead:
        """What ``member`` may change, area by area, and who to ask for the rest."""
        everyone = await self.effective(session, graph_id=graph.id)
        mine = next((roles for row, roles in everyone if row.user_id == member.user_id), list(member.roles or []))
        return AccessRead(
            roles=mine or [GraphRole.viewer.value],
            areas=[
                AccessArea(
                    area=area.name,
                    label=area.label,
                    role=area.role.value,
                    allowed=holds(mine, area.role),
                    holders=[row.user.username for row, roles in everyone if holds(roles, area.role)],
                )
                for area in AREAS
            ],
        )

    async def _keep_an_iam_admin(
        self, session: AsyncSession, graph: Graph, leaving: GraphMember, *, stays: bool
    ) -> None:
        """Refuse unless someone else — or ``leaving`` through a group, when they stay — still holds iam-admin."""
        if stays:
            via_groups = await self.group_roles_qs.group_roles(session, graph_id=graph.id, now=datetime.now(UTC))
            if GraphRole.iam_admin.value in via_groups.get(leaving.user_id, set()):
                return
        for row, roles in await self.effective(session, graph_id=graph.id):
            if row.user_id != leaving.user_id and GraphRole.iam_admin.value in roles:
                return
        raise ConflictError("A Graph always has an iam-admin. Make someone else an iam-admin first.")

    async def _keep_an_owner(self, session: AsyncSession, graph: Graph, leaving: GraphMember) -> None:
        rows = await self.members_qs.list_for_graph(session, graph_id=graph.id)
        if not any(row.holds(GraphRole.owner) for row in rows if row.user_id != leaving.user_id):
            raise ConflictError("A Graph always has an owner. Make someone else an owner first.")

    async def _emit(self, session: AsyncSession, action: str, graph: Graph, row: GraphMember, actor_id: str) -> None:
        await emit_event(
            session,
            action=action,
            target_kind=actions.TARGET_MEMBER,
            target_id=row.user_id,
            graph_id=graph.id,
            actor_id=actor_id,
            details={"username": row.user.username, "roles": list(row.roles or [])},
        )
