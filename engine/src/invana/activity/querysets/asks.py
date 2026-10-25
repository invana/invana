"""Queries for pending asks — approvals still waiting on a person.

The run page's *Waiting on you*, its Agents tab's dashed delegation asks and the
Runs list's *Waiting on you* tile all ask one question: which approvals are
still pending, in this Graph, optionally in these runs, of this kind, and
optionally naming this member as an approver. One statement answers all three.

Usage::

    asks = await pending_for(session, graph_id=graph.id, user_id=user.id)
    in_run = await pending_for(session, graph_id=graph.id, run_ids=tree_ids, kind="delegation")
"""

from __future__ import annotations

from sqlalchemy import Text, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.models import Approval, ApprovalStatus


class AskQuerySet:
    """Pending approvals, read for the run surfaces."""

    @staticmethod
    def _pending(
        *,
        graph_ids: list[str],
        user_id: str | None = None,
        run_ids: list[str] | None = None,
        kind: str | None = None,
    ):
        """The shared ``WHERE``: pending, in these Graphs, narrowed by what was given.

        ``approver_ids`` is a JSON list, matched as text on the quoted id so the
        statement reads the same on SQLite and Postgres.
        """
        where = [Approval.graph_id.in_(graph_ids), Approval.status == ApprovalStatus.pending.value]
        if user_id is not None:
            where.append(cast(Approval.approver_ids, Text).like(f'%"{user_id}"%'))
        if run_ids is not None:
            where.append(Approval.run_id.in_(run_ids))
        if kind is not None:
            where.append(Approval.kind == kind)
        return where

    async def pending(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        user_id: str | None = None,
        run_ids: list[str] | None = None,
        kind: str | None = None,
    ) -> list[Approval]:
        """Pending approvals in one Graph, oldest first.

        ``user_id`` keeps those that name the member as an approver; ``run_ids``
        those raised in one of these runs (an empty list matches nothing);
        ``kind`` one reader's word — ``budget`` · ``delegation`` · ``send`` ….
        """
        if run_ids is not None and not run_ids:
            return []
        stmt = (
            select(Approval)
            .where(*self._pending(graph_ids=[graph_id], user_id=user_id, run_ids=run_ids, kind=kind))
            .order_by(Approval.created_at)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def count_for_approver(self, session: AsyncSession, *, graph_ids: list[str], user_id: str) -> int:
        """How many pending approvals across these Graphs name ``user_id`` as an approver."""
        if not graph_ids:
            return 0
        stmt = select(func.count()).select_from(Approval).where(*self._pending(graph_ids=graph_ids, user_id=user_id))
        return int((await session.execute(stmt)).scalar_one())


async def pending_for(
    db: AsyncSession,
    *,
    graph_id: str,
    user_id: str | None = None,
    run_ids: list[str] | None = None,
    kind: str | None = None,
) -> list[Approval]:
    """Pending approvals in one Graph — see :meth:`AskQuerySet.pending`."""
    return await AskQuerySet().pending(db, graph_id=graph_id, user_id=user_id, run_ids=run_ids, kind=kind)
