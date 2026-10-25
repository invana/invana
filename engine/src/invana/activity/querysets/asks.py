"""Queries for pending asks — approvals still waiting on a person.

The run page's *Waiting on you*, its Agents tab's dashed delegation asks and the
Runs list's *Waiting on you* tile all ask one question: which approvals are
still pending, in this Graph, optionally in these runs, of this kind, and
optionally naming this member as an approver. One statement answers all three.

An ask a run holds on ends with its run: once the run (or the step that asked)
has ended, the ask is no longer waiting, and none of these reads return it —
before the clock has closed it ``expired`` as well as after
(:func:`held_by_ended_run`). A schedule's held delivery and a publish review
are raised *after* a run settles, so they stay pending on their own deadline.

Usage::

    asks = await pending_for(session, graph_id=graph.id, user_id=user.id)
    in_run = await pending_for(session, graph_id=graph.id, run_ids=tree_ids, kind="delegation")
    ended = await AskQuerySet().held_by_ended(session)   # locked, for the clock to close
"""

from __future__ import annotations

from sqlalchemy import Text, and_, cast, exists, func, not_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.models import Approval, ApprovalStatus
from invana.runtime.models import TaskRun
from invana.runtime.querysets.task_run import RUN_STATE_STATUSES

#: Approvals raised after a run settles rather than held by it.
AFTER_RUN_SUBJECTS = ("delivery", "model_publish")


def held_by_ended_run():
    """The clause: an ask a run holds on, whose run or asking step has ended."""
    ended = RUN_STATE_STATUSES["ended"]
    run_ended = exists().where(TaskRun.id == Approval.run_id, TaskRun.status.in_(ended))
    step_ended = exists().where(TaskRun.id == Approval.step_run_id, TaskRun.status.in_(ended))
    return and_(Approval.subject_kind.not_in(AFTER_RUN_SUBJECTS), or_(run_ended, step_ended))


def still_waiting():
    """The clause: pending, and not held by a run that has ended."""
    return and_(Approval.status == ApprovalStatus.pending.value, not_(held_by_ended_run()))


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
        where = [Approval.graph_id.in_(graph_ids), still_waiting()]
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

    async def held_by_ended(self, session: AsyncSession) -> list[Approval]:
        """Pending asks whose run has ended, locked so two clocks never close one twice."""
        stmt = (
            select(Approval)
            .where(Approval.status == ApprovalStatus.pending.value, held_by_ended_run())
            .with_for_update(skip_locked=True, of=Approval)
        )
        return list((await session.execute(stmt)).scalars())


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
