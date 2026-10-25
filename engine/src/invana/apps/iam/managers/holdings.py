"""What a principal holds — the one reading every access check starts from.

docs/for-developers/modules/identity-and-access/features/effective-access.md.
A principal is ``("person", user_id)``, ``("agent", agent_id)`` or
``("token", token_id)``. What it holds:

- its saved policies attached directly and not ended (an attachment made for a
  run counts only inside that run);
- those attached to every group it is in;
- for a person, the managed policies its membership names (its Graph roles),
  ``owner`` bringing the three it implies, and ``viewer`` always.

A spawned agent holds its parent's access: the caller resolves it to its root
authored agent before asking (this package sits below ``apps/agents``)::

    held = await HoldingsManager().policies_for(session, graph_id=g, principal=("agent", root_id), run_id=run.id)
    statements = [s for h in held for s in h.statements]

Boundary policies bound everyone and are read with :meth:`boundaries`.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.roles import GraphRole, holds
from invana.apps.iam.models import Policy
from invana.apps.iam.querysets import HoldingsQuerySet
from invana.core.policy import Statement, parse_statements

Principal = tuple[str, str]


@dataclass(frozen=True, slots=True)
class Held:
    """One policy a principal holds, and how it came to hold it."""

    policy: Policy
    #: *role* · *direct* · *via <group>* · *direct · for run* · *ask*.
    how: str
    statements: tuple[Statement, ...]


def _statements(policy: Policy) -> tuple[Statement, ...]:
    return tuple(parse_statements(policy.statements))


def effective_roles(direct: list[str], group_managed: list[str]) -> list[str]:
    """A person's Graph roles: direct plus their groups' managed policies, with what owner implies."""
    names = {*direct, *group_managed, GraphRole.viewer.value}
    return [r.value for r in GraphRole if r.value in names or holds(names, r)]


class HoldingsManager:
    """Stateless. The session is the first argument of every method."""

    qs = HoldingsQuerySet()

    async def policies_for(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        principal: Principal,
        run_id: str | None = None,
        now: datetime | None = None,
    ) -> list[Held]:
        """Every saved policy ``principal`` holds in this Graph, each once."""
        kind, ident = principal
        moment = now or datetime.now(UTC)
        groups: list[str] = []
        if kind in ("person", "agent"):
            groups = await self.qs.group_ids_of(session, graph_id=graph_id, kind=kind, member_id=ident)
        holders = [(kind, ident), *(("group", g) for g in groups)]
        out: dict[str, Held] = {}
        for policy, attachment in await self.qs.attached(
            session, graph_id=graph_id, holders=holders, now=moment, run_id=run_id
        ):
            if attachment.holder_kind == "group":
                how = "via group"
            elif attachment.run_id:
                how = "direct · for run"
            else:
                how = "ask" if attachment.via == "ask" else "direct"
            out.setdefault(policy.id, Held(policy=policy, how=how, statements=_statements(policy)))
        if kind == "person":
            direct = await self.qs.member_roles(session, graph_id=graph_id, user_id=ident)
            if direct is not None:
                group_managed = [h.policy.name for h in out.values() if h.policy.kind == "managed"]
                roles = effective_roles(direct, group_managed)
                for policy in await self.qs.managed_by_name(session, graph_id=graph_id, names=roles):
                    out.setdefault(policy.id, Held(policy=policy, how="role", statements=_statements(policy)))
        return sorted(out.values(), key=lambda h: (h.policy.kind != "managed", h.policy.name))

    async def roles_for(self, session: AsyncSession, *, graph_id: str, user_id: str) -> list[str]:
        """A member's effective Graph roles — direct and through their groups."""
        direct = await self.qs.member_roles(session, graph_id=graph_id, user_id=user_id) or []
        groups = await self.qs.group_ids_of(session, graph_id=graph_id, kind="person", member_id=user_id)
        group_managed = [
            p.name
            for p, _ in await self.qs.attached(
                session, graph_id=graph_id, holders=[("group", g) for g in groups], now=datetime.now(UTC)
            )
            if p.kind == "managed"
        ]
        return effective_roles(direct, group_managed)

    async def boundaries(self, session: AsyncSession, *, graph_id: str) -> list[Held]:
        return [
            Held(policy=p, how="boundary", statements=_statements(p))
            for p in await self.qs.boundaries(session, graph_id=graph_id)
        ]
