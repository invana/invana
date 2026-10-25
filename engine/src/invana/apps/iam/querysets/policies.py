"""Queries against ``policies``, ``policy_versions`` and ``policy_attachments``.

The reads the Policies list, a policy's page and its *Held by* tab make, and the
writes that create, version, attach and delete. Agents, runs and tokens are
declared here rather than imported, because this package sits below the
apps that own those rows.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.iam.models import Group, GroupMember, Policy, PolicyAttachment, PolicyVersion
from invana.core.lists import ListParams, PageInfo
from invana.core.lists.querysets import contains, page_of_select

# Declared on a private MetaData so they are real tables, which a schema
# translation reaches, without importing the models of apps above this one.
_foreign = sa.MetaData()
_agents = sa.Table("agents", _foreign, sa.Column("id"), sa.Column("graph_id"), sa.Column("name"), sa.Column("kind"))
_runs = sa.Table("task_runs", _foreign, sa.Column("id"), sa.Column("number"))
_tokens = sa.Table("personal_access_tokens", _foreign, sa.Column("id"), sa.Column("name"), sa.Column("user_id"))


def _live(now: datetime):
    return or_(PolicyAttachment.ends_at.is_(None), PolicyAttachment.ends_at > now)


class PolicyQuerySet:
    async def page(
        self, session: AsyncSession, *, graph_id: str, params: ListParams
    ) -> tuple[Sequence[Policy], PageInfo]:
        """One page of the Graph's policies, by name or most recently changed."""
        unfiltered = select(Policy).where(Policy.graph_id == graph_id)
        stmt = unfiltered
        if kinds := params.values("kind"):
            stmt = stmt.where(Policy.kind.in_(kinds))
        if statuses := params.values("status"):
            stmt = stmt.where(Policy.status.in_(statuses))
        if params.q:
            stmt = stmt.where(contains(params.q, Policy.name, Policy.description))
        return await page_of_select(
            session,
            stmt,
            params,
            unfiltered=unfiltered,
            sorts={"name": Policy.name, "updated_at": Policy.updated_at},
            id_column=Policy.id,
        )

    async def kind_counts(self, session: AsyncSession, *, graph_id: str) -> dict[str, int]:
        stmt = select(Policy.kind, func.count()).where(Policy.graph_id == graph_id).group_by(Policy.kind)
        return {kind: int(n) for kind, n in (await session.execute(stmt)).all()}

    async def get_by_name(self, session: AsyncSession, *, graph_id: str, name: str) -> Policy | None:
        stmt = select(Policy).where(Policy.graph_id == graph_id, Policy.name == name)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def names_taken(self, session: AsyncSession, *, graph_id: str, prefix: str) -> set[str]:
        stmt = select(Policy.name).where(Policy.graph_id == graph_id, Policy.name.like(f"{prefix}%"))
        return set((await session.execute(stmt)).scalars().all())

    async def managed(self, session: AsyncSession, *, graph_id: str) -> dict[str, Policy]:
        stmt = select(Policy).where(Policy.graph_id == graph_id, Policy.kind == "managed")
        return {p.name: p for p in (await session.execute(stmt)).scalars().all()}

    async def by_ids(self, session: AsyncSession, *, ids: Sequence[str]) -> dict[str, Policy]:
        if not ids:
            return {}
        stmt = select(Policy).where(Policy.id.in_(list(ids)))
        return {p.id: p for p in (await session.execute(stmt)).scalars().all()}

    async def add(self, session: AsyncSession, row: Policy | PolicyVersion | PolicyAttachment) -> None:
        session.add(row)
        await session.flush()

    async def delete(self, session: AsyncSession, policy: Policy) -> None:
        """The policy, its versions and its attachments."""
        await session.execute(delete(PolicyAttachment).where(PolicyAttachment.policy_id == policy.id))
        await session.execute(delete(PolicyVersion).where(PolicyVersion.policy_id == policy.id))
        await session.delete(policy)
        await session.flush()

    async def versions(self, session: AsyncSession, *, policy_id: str) -> list[PolicyVersion]:
        stmt = select(PolicyVersion).where(PolicyVersion.policy_id == policy_id).order_by(PolicyVersion.version.desc())
        return list((await session.execute(stmt)).scalars().all())

    # ── attachments ──────────────────────────────────────────────────────────

    async def attachments(
        self, session: AsyncSession, *, graph_id: str, now: datetime, policy_id: str | None = None
    ) -> list[PolicyAttachment]:
        """Attachments of this Graph that have not ended — one policy's, or every one."""
        stmt = select(PolicyAttachment).where(PolicyAttachment.graph_id == graph_id, _live(now))
        if policy_id is not None:
            stmt = stmt.where(PolicyAttachment.policy_id == policy_id)
        return list((await session.execute(stmt.order_by(PolicyAttachment.attached_at))).scalars().all())

    async def attachment(self, session: AsyncSession, *, policy_id: str, attachment_id: str) -> PolicyAttachment | None:
        stmt = select(PolicyAttachment).where(
            PolicyAttachment.id == attachment_id, PolicyAttachment.policy_id == policy_id
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def attachment_for(
        self, session: AsyncSession, *, policy_id: str, holder_kind: str, holder_id: str
    ) -> PolicyAttachment | None:
        stmt = select(PolicyAttachment).where(
            PolicyAttachment.policy_id == policy_id,
            PolicyAttachment.holder_kind == holder_kind,
            PolicyAttachment.holder_id == holder_id,
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def remove_attachment(self, session: AsyncSession, row: PolicyAttachment) -> None:
        await session.delete(row)
        await session.flush()

    async def remove_holder(self, session: AsyncSession, *, graph_id: str, holder_kind: str, holder_id: str) -> None:
        """Every attachment of one holder in this Graph."""
        await session.execute(
            delete(PolicyAttachment).where(
                PolicyAttachment.graph_id == graph_id,
                PolicyAttachment.holder_kind == holder_kind,
                PolicyAttachment.holder_id == holder_id,
            )
        )

    # ── names of holders this package does not own ───────────────────────────

    async def group_names(self, session: AsyncSession, *, graph_id: str) -> dict[str, str]:
        stmt = select(Group.id, Group.name).where(Group.graph_id == graph_id)
        return dict((await session.execute(stmt)).all())

    async def group_member_rows(self, session: AsyncSession, *, graph_id: str) -> list[GroupMember]:
        stmt = (
            select(GroupMember)
            .join(Group, Group.id == GroupMember.group_id)
            .where(Group.graph_id == graph_id)
            .order_by(GroupMember.added_at)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def agent_names(self, session: AsyncSession, *, graph_id: str) -> dict[str, str]:
        """Every agent of this Graph but the spawned ones."""
        stmt = select(_agents.c.id, _agents.c.name).where(_agents.c.graph_id == graph_id, _agents.c.kind != "spawned")
        return dict((await session.execute(stmt)).all())

    async def token_names(self, session: AsyncSession, *, ids: Sequence[str]) -> dict[str, str]:
        if not ids:
            return {}
        stmt = select(_tokens.c.id, _tokens.c.name).where(_tokens.c.id.in_(list(ids)))
        return dict((await session.execute(stmt)).all())

    async def run_numbers(self, session: AsyncSession, *, ids: Sequence[str]) -> dict[str, int | None]:
        if not ids:
            return {}
        stmt = select(_runs.c.id, _runs.c.number).where(_runs.c.id.in_(list(ids)))
        return dict((await session.execute(stmt)).all())
