"""Who holds a policy — its *Held by* tab, and attaching and detaching holders.

docs/for-developers/modules/identity-and-access/features/policies.md ·
features/people-and-groups.md. A holder is a person, a group, an agent or a
token of the same Graph. A managed policy is also held by every member whose
Graph roles include it; those rows read *role* and have no attachment to remove.

A custom draft may be attached to the holders it is meant for; the holding
takes effect only once the draft is saved (every access read skips drafts), so
its impact is drawn against them. Attaching is refused for a boundary (it bounds
everyone), for an inline policy (it belongs to its token), and for a holder that
is not this Graph's —
a person who is not a member, a group or an agent of another Graph reads as
absent. A holding may end with a run, after some days, or never::

    attachments = AttachmentManager()
    page, kinds = await attachments.holders(session, graph_id=g, policy=p, params=params)
    row = await attachments.attach(session, graph_id=g, policy=p, request=AttachRequest(...), actor_id=me)
    await attachments.detach(session, graph_id=g, policy=p, attachment_id=row.id, actor_id=me)

Who may call ``attach`` and ``detach`` is the route's guard (the ``iam`` area).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import GraphMember
from invana.apps.graphs.roles import holds
from invana.apps.iam.models import GroupMember, Policy, PolicyAttachment, PolicyKind, PolicyStatus
from invana.apps.iam.querysets.groups import GroupQuerySet
from invana.apps.iam.querysets.people import PeopleQuerySet
from invana.apps.iam.querysets.policies import PolicyQuerySet
from invana.apps.iam.schemas import AttachRequest, HeldBy, HolderRow
from invana.core.errors import ConflictError, NotFoundError, ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event
from invana.core.lists import ListParams, PageInfo, page_of_rows


def aware(moment: datetime | None) -> datetime | None:
    """A stored instant as UTC-aware — SQLite hands them back naive."""
    if moment is None:
        return None
    return moment if moment.tzinfo is not None else moment.replace(tzinfo=UTC)


def plural(n: int, one: str, many: str | None = None) -> str:
    return f"{n} {one if n == 1 else (many or one + 's')}"


def names_line(names: list[str], *, shown: int = 2) -> str:
    """``sam · lee · 2 more`` — or ``—`` for nobody."""
    if not names:
        return "—"
    head = " · ".join(names[:shown])
    return f"{head} · {len(names) - shown} more" if len(names) > shown else head


@dataclass
class GraphHolders:
    """One Graph's holders, read once, for every policy on a page."""

    members: list[GraphMember]
    attachments: list[PolicyAttachment]
    groups: dict[str, str]
    agents: dict[str, str]
    group_members: list[GroupMember]
    by_policy: dict[str, list[PolicyAttachment]] = field(default_factory=dict)

    def __post_init__(self) -> None:
        for a in self.attachments:
            self.by_policy.setdefault(a.policy_id, []).append(a)

    def role_holders(self, policy: Policy) -> list[GraphMember]:
        """Members whose own Graph roles are this managed policy."""
        if policy.kind != PolicyKind.managed.value:
            return []
        return [m for m in self.members if holds(m.roles or [], policy.name)]

    def group_line(self, group_id: str, usernames: dict[str, str]) -> str:
        names = [
            usernames.get(m.member_id) if m.member_kind == "person" else self.agents.get(m.member_id)
            for m in self.group_members
            if m.group_id == group_id
        ]
        return names_line([n for n in names if n])

    def held_by(self, policy: Policy, usernames: dict[str, str] | None = None) -> HeldBy:
        """The counts and the line the Policies list prints.

        Up to two holders are named (``sam · ravi``) when ``usernames`` is
        given; more than that are counted per kind.
        """
        if policy.kind == PolicyKind.boundary.value:
            return (
                HeldBy(line="the whole Graph") if policy.status == PolicyStatus.saved.value else HeldBy(line="nobody")
            )
        rows = self.by_policy.get(policy.id, [])
        attached_people = {a.holder_id for a in rows if a.holder_kind == "person"}
        people = attached_people | {m.user_id for m in self.role_holders(policy)}
        groups = [a.holder_id for a in rows if a.holder_kind == "group"]
        agents = sum(1 for a in rows if a.holder_kind == "agent")
        tokens = sum(1 for a in rows if a.holder_kind == "token")
        named = self._named(policy, rows, people, usernames)
        if named is not None:
            return HeldBy(people=len(people), groups=len(groups), agents=agents, tokens=tokens, line=named)
        parts: list[str] = []
        if len(groups) == 1:
            parts.append(f"group {self.groups.get(groups[0], '?')}")
        elif groups:
            parts.append(plural(len(groups), "group"))
        if people:
            if policy.name == "viewer" and len(people) == len(self.members):
                parts.append("every member")
            else:
                parts.append(plural(len(people), "person", "people"))
        if agents:
            parts.append(plural(agents, "agent"))
        if tokens:
            parts.append(plural(tokens, "token"))
        return HeldBy(
            people=len(people),
            groups=len(groups),
            agents=agents,
            tokens=tokens,
            line=" · ".join(parts) or "nobody",
        )


    def _named(
        self, policy: Policy, rows: list[PolicyAttachment], people: set[str], usernames: dict[str, str] | None
    ) -> str | None:
        """``sam · ravi`` for one or two holders, or ``None`` to count them."""
        if usernames is None or (policy.name == "viewer" and len(people) == len(self.members)):
            return None
        names: list[str] = [usernames.get(p, "") for p in sorted(people)]
        for a in rows:
            if a.holder_kind == "group":
                names.append(self.groups.get(a.holder_id, ""))
            elif a.holder_kind == "agent":
                names.append(self.agents.get(a.holder_id, ""))
            elif a.holder_kind == "token":
                return None
        if not names or len(names) > 2 or not all(names):
            return None
        return " · ".join(names)


class AttachmentManager:
    """Stateless. The session is the first argument of every method."""

    qs = PolicyQuerySet()
    people_qs = PeopleQuerySet()
    groups_qs = GroupQuerySet()

    async def graph_holders(self, session: AsyncSession, *, graph_id: str, now: datetime | None = None) -> GraphHolders:
        moment = now or datetime.now(UTC)
        return GraphHolders(
            members=await self.people_qs.members(session, graph_id=graph_id),
            attachments=await self.qs.attachments(session, graph_id=graph_id, now=moment),
            groups=await self.qs.group_names(session, graph_id=graph_id),
            agents=await self.qs.agent_names(session, graph_id=graph_id),
            group_members=await self.qs.group_member_rows(session, graph_id=graph_id),
        )

    async def holders(
        self, session: AsyncSession, *, graph_id: str, policy: Policy, params: ListParams
    ) -> tuple[list[HolderRow], PageInfo, dict[str, int]]:
        """One page of the policy's holders, with counts per kind over all of them."""
        rows = await self._rows(session, graph_id=graph_id, policy=policy)
        kinds: dict[str, int] = {}
        for r in rows:
            kinds[r.kind] = kinds.get(r.kind, 0) + 1
        kinds["all"] = len(rows)
        wanted = params.values("kind")
        narrowed = [
            r for r in rows if (not wanted or r.kind in wanted) and (not params.q or params.q.lower() in r.name.lower())
        ]
        page, info = page_of_rows(
            narrowed,
            params,
            unfiltered_total=len(rows),
            sorts={"name": lambda r: r.name.lower()},
            id_of=lambda r: r.id or f"{r.kind}:{r.holder_id}",
        )
        return page, info, kinds

    async def _rows(self, session: AsyncSession, *, graph_id: str, policy: Policy) -> list[HolderRow]:
        now = datetime.now(UTC)
        ctx = await self.graph_holders(session, graph_id=graph_id, now=now)
        attached = ctx.by_policy.get(policy.id, [])
        users = await self.people_qs.users(
            session,
            ids=[m.user_id for m in ctx.members]
            + [a.attached_by_id for a in attached if a.attached_by_id]
            + [m.member_id for m in ctx.group_members if m.member_kind == "person"],
        )
        usernames = {i: u.username for i, u in users.items()}
        tokens = await self.qs.token_names(session, ids=[a.holder_id for a in attached if a.holder_kind == "token"])
        runs = await self.qs.run_numbers(session, ids=[a.run_id for a in attached if a.run_id])
        out: list[HolderRow] = []
        for a in attached:
            out.append(self._row(a, ctx, users, usernames, tokens, runs, now))
        seen = {a.holder_id for a in attached if a.holder_kind == "person"}
        seen_agents = {a.holder_id for a in attached if a.holder_kind == "agent"}
        for a in attached:
            if a.holder_kind != "group":
                continue
            group = ctx.groups.get(a.holder_id, a.holder_id)
            for m in ctx.group_members:
                if m.group_id != a.holder_id:
                    continue
                if m.member_kind == "person" and m.member_id not in seen:
                    seen.add(m.member_id)
                    user = users.get(m.member_id)
                    name, line = (user.username if user else m.member_id), _full_name(user)
                elif m.member_kind == "agent" and m.member_id not in seen_agents:
                    seen_agents.add(m.member_id)
                    name, line = ctx.agents.get(m.member_id, m.member_id), "built in Agents"
                else:
                    continue
                out.append(
                    HolderRow(
                        kind=m.member_kind,
                        holder_id=m.member_id,
                        name=name,
                        line=line,
                        how=f"via {group}",
                        attached_by=usernames.get(a.attached_by_id) if a.attached_by_id else None,
                        attached_at=a.attached_at,
                        ends_at=aware(a.ends_at),
                    )
                )
        for m in ctx.role_holders(policy):
            if m.user_id in seen:
                continue
            user = users.get(m.user_id)
            out.append(
                HolderRow(
                    kind="person",
                    holder_id=m.user_id,
                    name=user.username if user else m.user_id,
                    line=_full_name(user),
                    how="role",
                    attached_at=m.created_at,
                )
            )
        return out

    def _row(self, a, ctx: GraphHolders, users, usernames, tokens, runs, now: datetime) -> HolderRow:
        if a.holder_kind == "person":
            user = users.get(a.holder_id)
            name, line = (user.username if user else a.holder_id), _full_name(user)
        elif a.holder_kind == "group":
            name, line = ctx.groups.get(a.holder_id, a.holder_id), ctx.group_line(a.holder_id, usernames)
        elif a.holder_kind == "agent":
            name, line = ctx.agents.get(a.holder_id, a.holder_id), "built in Agents"
        else:
            name, line = tokens.get(a.holder_id, a.holder_id), "a token"
        run_label = None
        if a.run_id:
            number = runs.get(a.run_id)
            run_label = f"run #{number}" if number is not None else f"run {a.run_id[:8]}"
        if a.via == "ask":
            how = "ask"
        elif run_label:
            how = f"direct · for {run_label}"
        else:
            how = "direct"
        ends_at = aware(a.ends_at)
        if run_label:
            ends_line = f"when {run_label} ends"
        elif ends_at is not None:
            days = max(1, math.ceil((ends_at - now).total_seconds() / 86400))
            ends_line = f"in {plural(days, 'day')}"
        else:
            ends_line = None
        return HolderRow(
            id=a.id,
            kind=a.holder_kind,
            holder_id=a.holder_id,
            name=name,
            line=line,
            how=how,
            attached_by=usernames.get(a.attached_by_id) if a.attached_by_id else None,
            attached_at=a.attached_at,
            ends_at=ends_at,
            ends_line=ends_line,
        )

    async def attach(
        self, session: AsyncSession, *, graph_id: str, policy: Policy, request: AttachRequest, actor_id: str
    ) -> HolderRow:
        """Attach ``policy`` to a person, group or agent of this Graph."""
        if policy.kind == PolicyKind.inline.value:
            raise ConflictError(f"{policy.name} is an inline policy; it belongs to its token.")
        if policy.kind == PolicyKind.boundary.value:
            raise ConflictError(f"{policy.name} is a boundary; it bounds the whole Graph without being attached.")
        await self._check_holder(session, graph_id=graph_id, kind=request.holder_kind, ident=request.holder_id)
        if await self.qs.attachment_for(
            session, policy_id=policy.id, holder_kind=request.holder_kind, holder_id=request.holder_id
        ):
            raise ConflictError(f"That {request.holder_kind} already holds {policy.name}.")
        ends_at, run_id = None, None
        if request.ends == "run":
            if not request.run_id:
                raise ValidationError("A holding for a run names the run.")
            run_id = request.run_id
        elif request.ends == "days":
            if not request.days:
                raise ValidationError("A holding for some days names how many.")
            ends_at = datetime.now(UTC) + timedelta(days=request.days)
        row = PolicyAttachment(
            policy_id=policy.id,
            graph_id=graph_id,
            holder_kind=request.holder_kind,
            holder_id=request.holder_id,
            attached_by_id=actor_id,
            ends_at=ends_at,
            run_id=run_id,
            via="direct",
        )
        await self.qs.add(session, row)
        await self._emit(session, actions.POLICY_ATTACH, graph_id, policy, row, actor_id)
        rows = await self._rows(session, graph_id=graph_id, policy=policy)
        return next(r for r in rows if r.id == row.id)

    async def detach(
        self, session: AsyncSession, *, graph_id: str, policy: Policy, attachment_id: str, actor_id: str
    ) -> None:
        row = await self.qs.attachment(session, policy_id=policy.id, attachment_id=attachment_id)
        if row is None or row.graph_id != graph_id:
            raise NotFoundError("No such holder of this policy.")
        await self._emit(session, actions.POLICY_DETACH, graph_id, policy, row, actor_id)
        await self.qs.remove_attachment(session, row)

    async def _check_holder(self, session: AsyncSession, *, graph_id: str, kind: str, ident: str) -> None:
        if kind == "person":
            if await self.people_qs.member(session, graph_id=graph_id, user_id=ident) is None:
                raise NotFoundError("That person is not a member of this Graph.")
        elif kind == "group":
            if await self.groups_qs.get(session, graph_id=graph_id, group_id=ident) is None:
                raise NotFoundError("No such group in this Graph.")
        elif kind == "agent":
            if ident not in await self.qs.agent_names(session, graph_id=graph_id):
                raise NotFoundError("No such agent in this Graph.")
        else:
            raise ValidationError(f"{kind} cannot hold a policy directly.")

    async def _emit(
        self, session: AsyncSession, action: str, graph_id: str, policy: Policy, row: PolicyAttachment, actor_id: str
    ) -> None:
        await emit_event(
            session,
            action=action,
            target_kind=actions.TARGET_POLICY,
            target_id=policy.id,
            graph_id=graph_id,
            actor_id=actor_id,
            details={
                "name": policy.name,
                "holder_kind": row.holder_kind,
                "holder_id": row.holder_id,
                "run_id": row.run_id,
                "ends_at": row.ends_at.isoformat() if row.ends_at else None,
            },
        )


def _full_name(user) -> str:
    if user is None:
        return ""
    if user.is_service_account:
        return "service account"
    return " ".join(p for p in (user.first_name, user.last_name) if p) or (user.email or "")
