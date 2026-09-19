"""Queries against ``task_runs`` — a whole run, and the nodes inside it.

One queryset, because there is one table. A *root* is a run with no
``parent_run_id``: what a Todo, a schedule or a session ask opened. A *node* is
a run with one. Two words for two shapes of the same row, so that a method name
says which it returns without a second class to look up.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.runtime.models import RunStatus, TaskRun


class TaskRunQuerySet:
    async def get(self, session: AsyncSession, run_id: str) -> TaskRun | None:
        return await session.get(TaskRun, run_id)

    # ── roots ────────────────────────────────────────────────────────────────
    async def for_todo(self, session: AsyncSession, *, todo_id: str) -> list[TaskRun]:
        stmt = (
            select(TaskRun)
            .where(TaskRun.todo_id == todo_id, TaskRun.parent_run_id.is_(None))
            .order_by(TaskRun.queued_at)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def ids_for_todo(self, session: AsyncSession, *, todo_id: str) -> list[str]:
        stmt = (
            select(TaskRun.id)
            .where(TaskRun.todo_id == todo_id, TaskRun.parent_run_id.is_(None))
            .order_by(TaskRun.queued_at)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def first_succeeded_load_at(self, session: AsyncSession, *, graph_id: str) -> datetime | None:
        """When records first landed in this Graph — `setup.LoadsReader`.

        **Both kinds count.** A bulk load validated nothing, but the records are
        in the database either way, and the question this answers is whether the
        Graph has data (inspect-what-landed.md · § 6.7).
        """
        stmt = select(func.min(TaskRun.finished_at)).where(
            TaskRun.graph_id == graph_id,
            TaskRun.ask_kind.in_(("import", "bulk")),
            TaskRun.status == RunStatus.succeeded.value,
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def latest_load_root(self, session: AsyncSession, *, model_id: str) -> str | None:
        """Where the records of *model_id* were last loaded from.

        The folder is a fact about a load, not about the model, so it is read
        back off the run that did the loading rather than stored a second time
        (task-model-migration § 6.7). Newest first and no status filter: a load
        that failed at validation still names the folder its files are in, which
        is the only thing being asked for here.
        """
        stmt = (
            select(TaskRun.params)
            .where(
                TaskRun.ask_kind == "import",
                TaskRun.parent_run_id.is_(None),
                TaskRun.params["model_id"].as_string() == model_id,
            )
            .order_by(TaskRun.queued_at.desc())
            .limit(1)
        )
        params = (await session.execute(stmt)).scalars().first()
        return str((params or {}).get("root") or "") or None

    async def for_graph(self, session: AsyncSession, *, graph_id: str, limit: int) -> list[TaskRun]:
        """The journal: roots only, newest first.

        A node is reached through the run that owns it — listing both would make
        one run seven rows (see-what-ran.md SR23).
        """
        stmt = (
            select(TaskRun)
            .where(TaskRun.graph_id == graph_id, TaskRun.parent_run_id.is_(None))
            .order_by(TaskRun.queued_at.desc())
            .limit(limit)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def running_for_graph(self, session: AsyncSession, *, graph_id: str) -> list[TaskRun]:
        """Queued or running roots — what the concurrency policy counts against."""
        stmt = select(TaskRun).where(
            TaskRun.graph_id == graph_id,
            TaskRun.parent_run_id.is_(None),
            TaskRun.status.in_([RunStatus.queued.value, RunStatus.running.value]),
        )
        return list((await session.execute(stmt)).scalars().all())

    # ── nodes ────────────────────────────────────────────────────────────────
    async def nodes_of(self, session: AsyncSession, *, run_id: str) -> list[TaskRun]:
        """The nodes of one run, in the order the plan lays them out."""
        stmt = (
            select(TaskRun)
            .where(TaskRun.parent_run_id == run_id)
            .order_by(TaskRun.seq, TaskRun.iteration, TaskRun.attempt)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def nodes_of_many(self, session: AsyncSession, *, run_ids: list[str]) -> list[TaskRun]:
        """Every named run's nodes in one query — a list row carries a count."""
        if not run_ids:
            return []
        stmt = (
            select(TaskRun)
            .where(TaskRun.parent_run_id.in_(run_ids))
            .order_by(TaskRun.parent_run_id, TaskRun.seq, TaskRun.attempt)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def children_of_nodes(self, session: AsyncSession, *, run_id: str) -> list[TaskRun]:
        """The runs delegated by any node of *run_id* — the fan-in's question.

        Two hops rather than a column: a delegated child names the node that
        delegated it, and that node names this run, so the edge is already
        written twice over. `child_run_id` would be a third copy of it.
        """
        nodes = select(TaskRun.id).where(TaskRun.parent_run_id == run_id)
        stmt = select(TaskRun).where(TaskRun.parent_run_id.in_(nodes)).order_by(TaskRun.queued_at)
        return list((await session.execute(stmt)).scalars().all())

    async def recent_nodes_for_graph(self, session: AsyncSession, *, graph_id: str, limit: int) -> list[TaskRun]:
        """Newest finished nodes in one Graph; unfinished ones sort last."""
        stmt = (
            select(TaskRun)
            .where(TaskRun.graph_id == graph_id, TaskRun.parent_run_id.is_not(None))
            .order_by(TaskRun.finished_at.desc().nullslast())
            .limit(limit)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def add(self, session: AsyncSession, run: TaskRun) -> TaskRun:
        session.add(run)
        await session.flush()
        return run
