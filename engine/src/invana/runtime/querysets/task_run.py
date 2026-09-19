"""Queries against ``task_runs`` — a whole run, and the nodes inside it.

One queryset, because there is one table. A *root* is a run with no
``parent_run_id``: what a Todo, a schedule or a session ask opened. A *node* is
a run with one. Two words for two shapes of the same row, so that a method name
says which it returns without a second class to look up.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Text, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

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

    async def skill_version_counts(self, session: AsyncSession, *, graph_id: str, version_id: str) -> tuple[int, int]:
        """How many nodes in this Graph were offered one skill version, and how
        many reported applying it.

        Counted over the whole Graph rather than a recent window: *offered 40,
        applied 31* is presented as a total, and a total taken from a page is a
        different number wearing the same label
        ([US2](docs/for-developers/modules/skills/features/usage.md)).

        ``skills_offered`` is a JSON array and containment operators differ
        between Postgres and SQLite, so the match is the same quoted-substring
        test ``core/events/querysets/event.py`` uses on ``skill_ids``. The ids
        are UUIDs, so a substring hit is an element hit.
        """
        like = f'%"{version_id}"%'
        stmt = select(
            func.count().filter(TaskRun.skills_offered.cast(Text).like(like)),
            func.count().filter(TaskRun.skills_applied.cast(Text).like(like)),
        ).where(TaskRun.graph_id == graph_id, TaskRun.parent_run_id.is_not(None))
        offered, applied = (await session.execute(stmt)).one()
        return int(offered or 0), int(applied or 0)

    async def skill_version_by_agent(
        self, session: AsyncSession, *, graph_id: str, version_id: str
    ) -> list[tuple[str | None, int, int]]:
        """``(agent_id, offered, applied)`` for one skill version.

        A step carries no ``agent_id`` of its own — the agent belongs to the run
        that opened it — so this joins each node to its parent. An agent that was
        offered the version and never applied it is exactly the row worth seeing,
        which is why the join is an outer one on the parent rather than a filter.
        """
        like = f'%"{version_id}"%'
        parent = aliased(TaskRun)
        stmt = (
            select(
                parent.agent_id,
                func.count().filter(TaskRun.skills_offered.cast(Text).like(like)),
                func.count().filter(TaskRun.skills_applied.cast(Text).like(like)),
            )
            .join(parent, parent.id == TaskRun.parent_run_id)
            .where(TaskRun.graph_id == graph_id, TaskRun.skills_offered.cast(Text).like(like))
            .group_by(parent.agent_id)
        )
        return [(row[0], int(row[1] or 0), int(row[2] or 0)) for row in (await session.execute(stmt)).all()]

    async def skill_version_by_outcome(
        self, session: AsyncSession, *, graph_id: str, version_id: str
    ) -> list[tuple[str | None, int, int]]:
        """``(outcome, offered, applied)`` — *applied in runs that served, versus
        runs that did not* (US1 C5). The outcome is the **run's**, not the step's:
        a step can succeed inside a run that never answered.
        """
        like = f'%"{version_id}"%'
        parent = aliased(TaskRun)
        stmt = (
            select(
                parent.outcome,
                func.count().filter(TaskRun.skills_offered.cast(Text).like(like)),
                func.count().filter(TaskRun.skills_applied.cast(Text).like(like)),
            )
            .join(parent, parent.id == TaskRun.parent_run_id)
            .where(TaskRun.graph_id == graph_id, TaskRun.skills_offered.cast(Text).like(like))
            .group_by(parent.outcome)
        )
        return [(row[0], int(row[1] or 0), int(row[2] or 0)) for row in (await session.execute(stmt)).all()]

    async def rule_citation_counts(
        self, session: AsyncSession, *, graph_id: str, versions_by_rule: dict[str, list[str]]
    ) -> dict[str, int]:
        """How many steps cited any version of each rule — one query, not one per rule.

        The aggregate list is as long as there are rules in the Graph, which is
        tens; the alternative is a round trip per row of a list surface.
        """
        if not versions_by_rule:
            return {}
        columns = []
        keys = []
        for rule_id, version_ids in versions_by_rule.items():
            if not version_ids:
                continue
            match = or_(*[TaskRun.rules_cited.cast(Text).like(f'%"{v}"%') for v in version_ids])
            columns.append(func.count().filter(match))
            keys.append(rule_id)
        if not columns:
            return {}
        stmt = select(*columns).where(TaskRun.graph_id == graph_id, TaskRun.parent_run_id.is_not(None))
        row = (await session.execute(stmt)).one()
        return {key: int(value or 0) for key, value in zip(keys, row, strict=True)}

    async def steps_citing(self, session: AsyncSession, *, graph_id: str, version_ids: list[str], limit: int):
        """Newest finished steps that cited any of these rule versions."""
        if not version_ids:
            return []
        match = or_(*[TaskRun.rules_cited.cast(Text).like(f'%"{v}"%') for v in version_ids])
        stmt = (
            select(TaskRun)
            .where(TaskRun.graph_id == graph_id, TaskRun.parent_run_id.is_not(None), match)
            .order_by(TaskRun.finished_at.desc().nullslast())
            .limit(limit)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def add(self, session: AsyncSession, run: TaskRun) -> TaskRun:
        session.add(run)
        await session.flush()
        return run
