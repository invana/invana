"""Queries against the eval tables and the eval runs they describe.

An eval run is a ``task_runs`` row with ``role=evaluate``; its ``label`` is the
subject address (``skill:<id>`` · ``agent:<id>``), so a subject's runs are one
indexed filter rather than a scan of ``params``.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.govern.models import RunTouch
from invana.core.lists import ListParams, PageInfo
from invana.core.lists.querysets import page_of_select
from invana.runtime.models import (
    EvalBudget,
    EvalCase,
    EvalResult,
    EvalSet,
    RunRole,
    RunStatus,
    TaskRun,
)


class EvalQuerySet:
    async def add(self, session: AsyncSession, row) -> None:
        session.add(row)
        await session.flush()

    async def delete(self, session: AsyncSession, row) -> None:
        await session.delete(row)
        await session.flush()

    # ── sets and cases ───────────────────────────────────────────────────────

    async def set_for(self, session: AsyncSession, *, subject_kind: str, subject_id: str) -> EvalSet | None:
        stmt = select(EvalSet).where(EvalSet.subject_kind == subject_kind, EvalSet.subject_id == subject_id)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def sets_for_graph(self, session: AsyncSession, *, graph_id: str) -> list[EvalSet]:
        stmt = select(EvalSet).where(EvalSet.graph_id == graph_id).order_by(EvalSet.created_at)
        return list((await session.execute(stmt)).scalars().all())

    async def cases(self, session: AsyncSession, *, eval_set_id: str, status: str | None = None) -> list[EvalCase]:
        stmt = select(EvalCase).where(EvalCase.eval_set_id == eval_set_id)
        if status is not None:
            stmt = stmt.where(EvalCase.status == status)
        return list((await session.execute(stmt.order_by(EvalCase.created_at))).scalars().all())

    async def case(self, session: AsyncSession, *, eval_set_id: str, case_id: str) -> EvalCase | None:
        row = await session.get(EvalCase, case_id)
        return row if row is not None and row.eval_set_id == eval_set_id else None

    # ── runs ─────────────────────────────────────────────────────────────────

    async def runs(self, session: AsyncSession, *, graph_id: str, subject: str, limit: int = 50) -> list[TaskRun]:
        """A subject's eval runs, newest first."""
        stmt = (
            select(TaskRun)
            .where(
                TaskRun.graph_id == graph_id,
                TaskRun.role == RunRole.evaluate.value,
                TaskRun.parent_run_id.is_(None),
                TaskRun.label == subject,
            )
            .order_by(TaskRun.queued_at.desc())
            .limit(limit)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def settled_runs(self, session: AsyncSession, *, graph_id: str, subject: str) -> list[TaskRun]:
        """A subject's settled eval runs, newest first."""
        stmt = (
            select(TaskRun)
            .where(
                TaskRun.graph_id == graph_id,
                TaskRun.role == RunRole.evaluate.value,
                TaskRun.parent_run_id.is_(None),
                TaskRun.label == subject,
                TaskRun.status == RunStatus.succeeded.value,
            )
            .order_by(TaskRun.finished_at.desc())
            .limit(50)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def page_tests(
        self, session: AsyncSession, *, graph_id: str, label: str, params: ListParams
    ) -> tuple[Sequence[TaskRun], PageInfo]:
        """One page of the test runs carrying ``label``, newest first."""
        stmt = select(TaskRun).where(
            TaskRun.graph_id == graph_id,
            TaskRun.role == RunRole.evaluate.value,
            TaskRun.parent_run_id.is_(None),
            TaskRun.label == label,
        )
        return await page_of_select(
            session, stmt, params, unfiltered=stmt, sorts={"created_at": TaskRun.created_at}, id_column=TaskRun.id
        )

    async def children(self, session: AsyncSession, *, run_id: str) -> list[TaskRun]:
        stmt = select(TaskRun).where(TaskRun.parent_run_id == run_id).order_by(TaskRun.seq)
        return list((await session.execute(stmt)).scalars().all())

    async def results(self, session: AsyncSession, *, run_id: str) -> list[EvalResult]:
        stmt = select(EvalResult).where(EvalResult.eval_run_id == run_id).order_by(EvalResult.created_at)
        return list((await session.execute(stmt)).scalars().all())

    async def tokens_of(self, session: AsyncSession, *, run_ids: list[str]) -> int:
        if not run_ids:
            return 0
        stmt = select(func.coalesce(func.sum(TaskRun.tokens_in), 0) + func.coalesce(func.sum(TaskRun.tokens_out), 0))
        return int((await session.execute(stmt.where(TaskRun.id.in_(run_ids)))).scalar_one() or 0)

    async def touches(self, session: AsyncSession, *, run_ids: list[str]) -> list[RunTouch]:
        if not run_ids:
            return []
        stmt = select(RunTouch).where(RunTouch.run_id.in_(run_ids))
        return list((await session.execute(stmt)).scalars().all())

    # ── the budget ───────────────────────────────────────────────────────────

    async def budget(self, session: AsyncSession, *, graph_id: str) -> EvalBudget | None:
        return await session.get(EvalBudget, graph_id)

    async def spent_since(self, session: AsyncSession, *, graph_id: str, since: datetime) -> int:
        """Eval tokens spent since ``since``: every replayed ask's, and every judge's."""
        runs = select(TaskRun.id).where(
            TaskRun.graph_id == graph_id,
            TaskRun.role == RunRole.evaluate.value,
            TaskRun.parent_run_id.is_(None),
            TaskRun.queued_at >= since,
        )
        replayed = select(func.coalesce(func.sum(EvalResult.tokens), 0)).where(EvalResult.eval_run_id.in_(runs))
        judged = select(
            func.coalesce(func.sum(TaskRun.tokens_in), 0) + func.coalesce(func.sum(TaskRun.tokens_out), 0)
        ).where(TaskRun.id.in_(runs))
        return int((await session.execute(replayed)).scalar_one() or 0) + int(
            (await session.execute(judged)).scalar_one() or 0
        )
