"""IAM's People page — a Graph's members and service accounts, with what each holds.

docs/for-developers/modules/identity-and-access/features/people-and-groups.md.
One row per member: the groups they are in, the policies they hold (their
Graph roles, then what is attached to them), the count of their live tokens
that reach this Graph, and how they sign in — *password* for a person, *no
sign-in · token only* for a service account::

    rows, info, kinds = await PeopleManager().page(session, graph_id=g, params=params)

Every count here is the engine's.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import GraphMember
from invana.apps.graphs.roles import GraphRole
from invana.apps.iam.querysets.groups import GroupQuerySet
from invana.apps.iam.querysets.people import PeopleQuerySet
from invana.apps.iam.querysets.policies import PolicyQuerySet
from invana.apps.iam.schemas import PersonRow
from invana.core.lists import ListParams, PageInfo, page_of_rows

PASSWORD = "password"
TOKEN_ONLY = "no sign-in · token only"


class PeopleManager:
    """Stateless. The session is the first argument of every method."""

    qs = PeopleQuerySet()
    policies_qs = PolicyQuerySet()
    groups_qs = GroupQuerySet()

    async def page(
        self, session: AsyncSession, *, graph_id: str, params: ListParams
    ) -> tuple[list[PersonRow], PageInfo, dict[str, int]]:
        rows = await self.rows(session, graph_id=graph_id)
        kinds = {"all": len(rows), "person": 0, "service": 0}
        for r in rows:
            kinds[r.kind] += 1
        wanted = params.values("kind")
        q = (params.q or "").lower()
        narrowed = [
            r
            for r in rows
            if (not wanted or r.kind in wanted)
            and (not q or q in r.username.lower() or q in (r.email or "").lower() or q in r.name.lower())
        ]
        page, info = page_of_rows(
            narrowed,
            params,
            unfiltered_total=len(rows),
            sorts={"username": lambda r: r.username},
            id_of=lambda r: r.user_id,
        )
        return page, info, kinds

    async def rows(self, session: AsyncSession, *, graph_id: str, user_id: str | None = None) -> list[PersonRow]:
        """Every member as a People row — or only ``user_id``'s."""
        now = datetime.now(UTC)
        members = await self.qs.members(session, graph_id=graph_id)
        if user_id is not None:
            members = [m for m in members if m.user_id == user_id]
        group_names = await self.policies_qs.group_names(session, graph_id=graph_id)
        in_groups: dict[str, list[str]] = {}
        for gm in await self.policies_qs.group_member_rows(session, graph_id=graph_id):
            if gm.member_kind == "person":
                in_groups.setdefault(gm.member_id, []).append(group_names.get(gm.group_id, gm.group_id))
        attached = [
            a
            for a in await self.policies_qs.attachments(session, graph_id=graph_id, now=now)
            if a.holder_kind == "person"
        ]
        policies = await self.policies_qs.by_ids(session, ids=list({a.policy_id for a in attached}))
        held: dict[str, list[str]] = {}
        for a in attached:
            if a.policy_id in policies and a.run_id is None:
                held.setdefault(a.holder_id, []).append(policies[a.policy_id].name)
        tokens = await self.qs.live_tokens(session, graph_id=graph_id, user_ids=[m.user_id for m in members], now=now)
        return [self._row(m, in_groups, held, tokens) for m in members]

    @staticmethod
    def _row(
        member: GraphMember, in_groups: dict[str, list[str]], held: dict[str, list[str]], tokens: dict[str, int]
    ) -> PersonRow:
        user = member.user
        roles = list(member.roles or [GraphRole.viewer.value])
        service = bool(user.is_service_account)
        name = " ".join(p for p in (user.first_name, user.last_name) if p) or user.username
        return PersonRow(
            user_id=user.id,
            username=user.username,
            name=name,
            email=user.email,
            kind="service" if service else "person",
            groups=sorted(in_groups.get(user.id, [])),
            policies=roles + sorted(n for n in held.get(user.id, []) if n not in roles),
            tokens=tokens.get(user.id, 0),
            signs_in_with=TOKEN_ONLY if service else PASSWORD,
            description=(user.preferences or {}).get("description") if service else None,
        )
