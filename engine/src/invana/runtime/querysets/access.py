"""Queries behind effective access — the gate's lookups and IAM's reads.

docs/for-developers/modules/identity-and-access/features/effective-access.md ·
features/policies.md. Every count, sum and window here is SQL, so the engine
owns each number IAM prints: refusals in seven days, a loss's use in thirty,
tokens a month, live runs. ``runtime/access.py`` and
``runtime/managers/access.py`` call it; nothing else should.

A *run row* is a ``task_runs`` row with no ``task_key`` — a root run or a
delegated child run, never a step.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent, AgentKind
from invana.apps.govern.models import Lens, LensKind
from invana.apps.graphs.models import GraphMember
from invana.apps.iam.models import Group, Policy, PolicyStatus
from invana.core.auth.models import PersonalAccessToken, User
from invana.core.ledger.models import LedgerRow
from invana.core.lists import ListParams, PageInfo
from invana.core.lists.querysets import contains, page_of_select
from invana.runtime.models import RunStatus, TaskRun


class AccessQuerySet:
    """Stateless. The session is the first argument of every method."""

    # ── principals ───────────────────────────────────────────────────────────

    async def user(self, session: AsyncSession, *, ref: str) -> User | None:
        """A person by id, else by username."""
        found = await session.get(User, ref)
        if found is not None:
            return found
        stmt = select(User).where(User.username == ref)
        return (await session.execute(stmt)).scalars().first()

    async def usernames(self, session: AsyncSession, *, ids: Sequence[str]) -> dict[str, str]:
        wanted = [i for i in dict.fromkeys(ids) if i]
        if not wanted:
            return {}
        stmt = select(User.id, User.username).where(User.id.in_(wanted))
        return dict((await session.execute(stmt)).all())

    async def token(self, session: AsyncSession, *, token_id: str) -> PersonalAccessToken | None:
        return await session.get(PersonalAccessToken, token_id)

    async def policy(self, session: AsyncSession, *, policy_id: str | None) -> Policy | None:
        return await session.get(Policy, policy_id) if policy_id else None

    async def policy_by_name(self, session: AsyncSession, *, graph_id: str, name: str) -> Policy | None:
        """One policy of this Graph by name, saved or draft."""
        stmt = select(Policy).where(Policy.graph_id == graph_id, Policy.name == name)
        return (await session.execute(stmt)).scalars().first()

    async def world(self, session: AsyncSession, *, graph_id: str, world_id: str) -> Lens | None:
        """A world of this Graph, by id or by its slug."""
        stmt = select(Lens).where(
            Lens.graph_id == graph_id,
            Lens.kind == LensKind.world.value,
            or_(Lens.id == world_id, Lens.key == world_id),
        )
        return (await session.execute(stmt)).scalars().first()

    # ── agents ───────────────────────────────────────────────────────────────

    async def agents(self, session: AsyncSession, *, graph_id: str) -> list[Agent]:
        """Every agent of the Graph that is not spawned, by name."""
        stmt = (
            select(Agent).where(Agent.graph_id == graph_id, Agent.kind != AgentKind.spawned.value).order_by(Agent.name)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def agents_by_ids(self, session: AsyncSession, *, ids: Sequence[str]) -> dict[str, Agent]:
        wanted = [i for i in dict.fromkeys(ids) if i]
        if not wanted:
            return {}
        stmt = select(Agent).where(Agent.id.in_(wanted))
        return {a.id: a for a in (await session.execute(stmt)).scalars().all()}

    async def agent_page(
        self, session: AsyncSession, *, graph_id: str, params: ListParams
    ) -> tuple[Sequence[Agent], PageInfo, dict[str, int]]:
        """One page of IAM's Agents list — every agent that is not spawned — with counts per kind."""
        base = select(Agent).where(Agent.graph_id == graph_id, Agent.kind != AgentKind.spawned.value)
        stmt = base
        if params.q:
            stmt = stmt.where(contains(params.q, Agent.name))
        if params.values("kind"):
            stmt = stmt.where(Agent.kind.in_(params.values("kind")))
        rows, info = await page_of_select(
            session, stmt, params, unfiltered=base, sorts={"name": Agent.name}, id_column=Agent.id
        )
        counted = (
            select(Agent.kind, func.count())
            .where(Agent.graph_id == graph_id, Agent.kind != AgentKind.spawned.value)
            .group_by(Agent.kind)
        )
        kinds = {kind: int(n) for kind, n in (await session.execute(counted)).all()}
        kinds["all"] = sum(kinds.values())
        return rows, info, kinds

    # ── the ledger ───────────────────────────────────────────────────────────

    async def refused_since(
        self, session: AsyncSession, *, graph_id: str, agent_ids: Sequence[str], since: datetime
    ) -> dict[str, list[tuple[str, int]]]:
        """Per agent, its refused acts since ``since`` as ``(act, count)``, commonest first."""
        if not agent_ids:
            return {}
        stmt = (
            select(LedgerRow.actor_agent_id, LedgerRow.act, func.count())
            .where(
                LedgerRow.graph_id == graph_id,
                LedgerRow.actor_agent_id.in_(list(agent_ids)),
                LedgerRow.verdict == "refused",
                LedgerRow.at >= since,
            )
            .group_by(LedgerRow.actor_agent_id, LedgerRow.act)
        )
        out: dict[str, list[tuple[str, int]]] = {}
        for agent_id, act, n in (await session.execute(stmt)).all():
            out.setdefault(agent_id, []).append((act, int(n)))
        for acts in out.values():
            acts.sort(key=lambda pair: (-pair[1], pair[0]))
        return out

    async def refusal_page(
        self, session: AsyncSession, *, graph_id: str, agent_id: str, params: ListParams
    ) -> tuple[Sequence[LedgerRow], PageInfo]:
        """One page of an agent's refused ledger rows, newest first."""
        base = select(LedgerRow).where(
            LedgerRow.graph_id == graph_id, LedgerRow.actor_agent_id == agent_id, LedgerRow.verdict == "refused"
        )
        stmt = base.where(contains(params.q, LedgerRow.act, LedgerRow.rule)) if params.q else base
        return await page_of_select(
            session, stmt, params, unfiltered=base, sorts={"at": LedgerRow.at}, id_column=LedgerRow.id
        )

    async def uses_since(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        actor_kind: str,
        actor_id: str,
        acts: Sequence[str],
        since: datetime,
    ) -> dict[str, int]:
        """How many ledger rows a person or an agent wrote for each act since ``since``."""
        if not acts:
            return {}
        who = LedgerRow.actor_agent_id == actor_id if actor_kind == "agent" else LedgerRow.actor_user_id == actor_id
        stmt = (
            select(LedgerRow.act, func.count())
            .where(LedgerRow.graph_id == graph_id, who, LedgerRow.act.in_(list(acts)), LedgerRow.at >= since)
            .group_by(LedgerRow.act)
        )
        return {act: int(n) for act, n in (await session.execute(stmt)).all()}

    # ── runs ─────────────────────────────────────────────────────────────────

    async def tokens_since(self, session: AsyncSession, *, agent_ids: Sequence[str], since: datetime) -> int:
        """The tokens settled run rows of these agents spent since ``since``."""
        if not agent_ids:
            return 0
        stmt = select(func.coalesce(func.sum(TaskRun.run_tokens), 0)).where(
            TaskRun.task_key == "",
            TaskRun.agent_id.in_(list(agent_ids)),
            TaskRun.finished_at >= since,
        )
        return int((await session.execute(stmt)).scalar_one() or 0)

    async def run_tokens_since(self, session: AsyncSession, *, agent_ids: Sequence[str], since: datetime) -> list[int]:
        """Each settled root run's tokens since ``since``, smallest first."""
        if not agent_ids:
            return []
        stmt = (
            select(TaskRun.run_tokens)
            .where(
                TaskRun.task_key == "",
                TaskRun.parent_run_id.is_(None),
                TaskRun.agent_id.in_(list(agent_ids)),
                TaskRun.finished_at >= since,
                TaskRun.run_tokens.is_not(None),
            )
            .order_by(TaskRun.run_tokens)
        )
        return [int(n) for n in (await session.execute(stmt)).scalars().all()]

    async def live_runs(self, session: AsyncSession, *, agent_ids: Sequence[str]) -> list[TaskRun]:
        """The running run rows of these agents."""
        if not agent_ids:
            return []
        stmt = select(TaskRun).where(
            TaskRun.task_key == "",
            TaskRun.agent_id.in_(list(agent_ids)),
            TaskRun.status == RunStatus.running.value,
        )
        return list((await session.execute(stmt)).scalars().all())

    # ── the IAM home ─────────────────────────────────────────────────────────

    async def member_counts(self, session: AsyncSession, *, graph_id: str) -> tuple[int, int]:
        """``(people, service accounts)`` among the Graph's members."""
        stmt = (
            select(User.is_service_account, func.count())
            .join(GraphMember, GraphMember.user_id == User.id)
            .where(GraphMember.graph_id == graph_id)
            .group_by(User.is_service_account)
        )
        counts = {bool(flag): int(n) for flag, n in (await session.execute(stmt)).all()}
        return counts.get(False, 0), counts.get(True, 0)

    async def group_count(self, session: AsyncSession, *, graph_id: str) -> int:
        stmt = select(func.count()).select_from(Group).where(Group.graph_id == graph_id)
        return int((await session.execute(stmt)).scalar_one())

    async def agent_count(self, session: AsyncSession, *, graph_id: str) -> int:
        stmt = (
            select(func.count())
            .select_from(Agent)
            .where(Agent.graph_id == graph_id, Agent.kind != AgentKind.spawned.value)
        )
        return int((await session.execute(stmt)).scalar_one())

    async def saved_policy_counts(self, session: AsyncSession, *, graph_id: str) -> dict[str, int]:
        stmt = (
            select(Policy.kind, func.count())
            .where(Policy.graph_id == graph_id, Policy.status == PolicyStatus.saved.value)
            .group_by(Policy.kind)
        )
        return {kind: int(n) for kind, n in (await session.execute(stmt)).all()}

    async def token_counts(
        self, session: AsyncSession, *, graph_id: str, now: datetime, week_end: datetime
    ) -> tuple[int, int]:
        """``(live, expiring before week_end)`` among tokens that reach this Graph.

        A token reaches it when it was minted for it, or when it is a profile
        token whose holder is a member.
        """
        members = select(GraphMember.user_id).where(GraphMember.graph_id == graph_id)
        reaches = or_(
            PersonalAccessToken.graph_id == graph_id,
            (PersonalAccessToken.graph_id.is_(None)) & PersonalAccessToken.user_id.in_(members),
        )
        live = (
            PersonalAccessToken.revoked_at.is_(None),
            or_(PersonalAccessToken.expires_at.is_(None), PersonalAccessToken.expires_at > now),
        )
        total = select(func.count()).select_from(PersonalAccessToken).where(reaches, *live)
        expiring = total.where(PersonalAccessToken.expires_at <= week_end)
        return (
            int((await session.execute(total)).scalar_one()),
            int((await session.execute(expiring)).scalar_one()),
        )
