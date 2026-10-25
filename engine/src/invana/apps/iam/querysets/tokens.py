"""Queries behind IAM Tokens — the tokens a Graph lists, and their inline policies.

A Graph lists the tokens bound to it and the profile tokens (no Graph) of its
members; a revoked token leaves the list. Which of them a caller may revoke is
the manager's rule, not a query's.
"""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import GraphMember
from invana.apps.iam.models import Policy, PolicyAttachment
from invana.core.auth.models import PersonalAccessToken, User
from invana.core.lists import ListParams, PageInfo
from invana.core.lists.querysets import contains, page_of_select


class IamTokenQuerySet:
    @staticmethod
    def _of_graph(graph_id: str):
        members = select(GraphMember.user_id).where(GraphMember.graph_id == graph_id)
        return select(PersonalAccessToken).where(
            PersonalAccessToken.revoked_at.is_(None),
            or_(
                PersonalAccessToken.graph_id == graph_id,
                and_(PersonalAccessToken.graph_id.is_(None), PersonalAccessToken.user_id.in_(members)),
            ),
        )

    async def page_for_graph(
        self, session: AsyncSession, *, graph_id: str, params: ListParams
    ) -> tuple[Sequence[PersonalAccessToken], PageInfo]:
        """One page of the live tokens this Graph lists; ``q`` matches the token's name."""
        unfiltered = self._of_graph(graph_id)
        stmt = unfiltered.where(contains(params.q, PersonalAccessToken.name)) if params.q else unfiltered
        return await page_of_select(
            session,
            stmt,
            params,
            unfiltered=unfiltered,
            sorts={"created_at": PersonalAccessToken.created_at, "name": PersonalAccessToken.name},
            id_column=PersonalAccessToken.id,
        )

    async def get_listed(self, session: AsyncSession, *, graph_id: str, token_id: str) -> PersonalAccessToken | None:
        """A live token this Graph lists, or ``None``."""
        stmt = self._of_graph(graph_id).where(PersonalAccessToken.id == token_id)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def live_for_user(self, session: AsyncSession, *, user_id: str) -> list[PersonalAccessToken]:
        stmt = select(PersonalAccessToken).where(
            PersonalAccessToken.user_id == user_id, PersonalAccessToken.revoked_at.is_(None)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def users_by_ids(self, session: AsyncSession, ids: Sequence[str]) -> dict[str, User]:
        if not ids:
            return {}
        rows = (await session.execute(select(User).where(User.id.in_(list(set(ids)))))).scalars().all()
        return {u.id: u for u in rows}

    async def policies_by_ids(self, session: AsyncSession, ids: Sequence[str]) -> dict[str, Policy]:
        if not ids:
            return {}
        rows = (await session.execute(select(Policy).where(Policy.id.in_(list(set(ids)))))).scalars().all()
        return {p.id: p for p in rows}

    async def policy_names_like(self, session: AsyncSession, *, graph_id: str, prefix: str) -> set[str]:
        """The names in this Graph starting with ``prefix`` — to pick a free one."""
        stmt = select(Policy.name).where(Policy.graph_id == graph_id, Policy.name.like(f"{prefix}%"))
        return set((await session.execute(stmt)).scalars().all())

    async def add_inline(
        self, session: AsyncSession, *, token: PersonalAccessToken, policy: Policy, attached_by_id: str
    ) -> None:
        """Write the token, its inline policy and the attachment that makes the token hold it."""
        session.add(policy)
        session.add(token)
        await session.flush()
        session.add(
            PolicyAttachment(
                policy_id=policy.id,
                graph_id=policy.graph_id,
                holder_kind="token",
                holder_id=token.id,
                attached_by_id=attached_by_id,
            )
        )
        token.policy_id = policy.id
        await session.flush()

    async def add(self, session: AsyncSession, token: PersonalAccessToken) -> None:
        session.add(token)
        await session.flush()

    async def delete_policy(self, session: AsyncSession, policy_id: str) -> None:
        """Delete an inline policy; its attachment goes with it."""
        policy = await session.get(Policy, policy_id)
        if policy is None:
            return
        attachments = select(PolicyAttachment).where(PolicyAttachment.policy_id == policy_id)
        for row in (await session.execute(attachments)).scalars().all():
            await session.delete(row)
        await session.delete(policy)
        await session.flush()
