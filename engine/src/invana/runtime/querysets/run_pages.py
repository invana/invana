"""Queries behind the run page — a root run's whole tree and what it left behind.

A run is a tree in one table: the root, its steps (``parent_run_id`` = root),
a delegated or spawned child run under the step that opened it, that child's
steps, and so on. Every tab of the run page reads the tree, so it is loaded
once, level by level — one query per level, never one per row.

The other reads here are the records a tree produced or engaged, fetched for
every run id in the tree at once: emissions, ``run_touches`` and the Todos a
step wrote down.
"""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent
from invana.apps.govern.models import RunTouch
from invana.apps.sessions.models import Session
from invana.apps.work.models import Task as Todo
from invana.runtime.models import Emission, TaskRun

#: How deep a tree is walked. A run's ``max_depth`` is single digits; the bound
#: keeps a corrupt cycle from walking forever.
MAX_LEVELS = 32


class RunPageQuerySet:
    async def tree(self, session: AsyncSession, *, run_id: str) -> list[TaskRun]:
        """Every row under ``run_id`` — steps, child runs and their steps — in
        breadth order, the root itself excluded."""
        out: list[TaskRun] = []
        frontier = [run_id]
        for _ in range(MAX_LEVELS):
            if not frontier:
                break
            stmt = (
                select(TaskRun)
                .where(TaskRun.parent_run_id.in_(frontier))
                .order_by(TaskRun.seq, TaskRun.iteration, TaskRun.attempt, TaskRun.queued_at)
            )
            rows = list((await session.execute(stmt)).scalars().all())
            out.extend(rows)
            frontier = [r.id for r in rows]
        return out

    async def agents_under(self, session: AsyncSession, *, run_ids: list[str]) -> dict[str, int]:
        """``{root_id: n}`` — how many runs with an agent sit anywhere under each root.

        Walked for a whole page of roots at once: each level is one query that
        carries every root's frontier, keyed back to the root it descends from.
        A root with none is absent; the root itself is not counted.
        """
        owner = {run_id: run_id for run_id in run_ids}
        counts: dict[str, int] = {}
        frontier = list(run_ids)
        for _ in range(MAX_LEVELS):
            if not frontier:
                break
            stmt = select(TaskRun.id, TaskRun.parent_run_id, TaskRun.agent_id).where(
                TaskRun.parent_run_id.in_(frontier)
            )
            nxt: list[str] = []
            for row_id, parent_id, agent_id in (await session.execute(stmt)).all():
                root = owner[parent_id]
                owner[row_id] = root
                nxt.append(row_id)
                if agent_id:
                    counts[root] = counts.get(root, 0) + 1
            frontier = nxt
        return counts

    async def agents_by_ids(self, session: AsyncSession, *, ids: Iterable[str]) -> dict[str, Agent]:
        """``{agent_id: Agent}`` for the agents a tree names — retired ones too."""
        wanted = [i for i in set(ids) if i]
        if not wanted:
            return {}
        rows = (await session.execute(select(Agent).where(Agent.id.in_(wanted)))).scalars().all()
        return {a.id: a for a in rows}

    async def agent_names(self, session: AsyncSession, *, ids: Iterable[str]) -> dict[str, str]:
        """``{agent_id: name}`` as the agents are named now."""
        wanted = [i for i in set(ids) if i]
        if not wanted:
            return {}
        return dict((await session.execute(select(Agent.id, Agent.name).where(Agent.id.in_(wanted)))).all())

    async def session_titles(self, session: AsyncSession, *, ids: Iterable[str]) -> dict[str, str]:
        wanted = [i for i in set(ids) if i]
        if not wanted:
            return {}
        return dict((await session.execute(select(Session.id, Session.title).where(Session.id.in_(wanted)))).all())

    async def todo_titles(self, session: AsyncSession, *, ids: Iterable[str]) -> dict[str, str]:
        wanted = [i for i in set(ids) if i]
        if not wanted:
            return {}
        return dict((await session.execute(select(Todo.id, Todo.title).where(Todo.id.in_(wanted)))).all())

    async def emissions(self, session: AsyncSession, *, run_ids: list[str]) -> list[Emission]:
        """Every emission the tree's runs produced, in the order they were made."""
        if not run_ids:
            return []
        stmt = select(Emission).where(Emission.run_id.in_(run_ids)).order_by(Emission.created_at, Emission.seq)
        return list((await session.execute(stmt)).scalars().all())

    async def touches(self, session: AsyncSession, *, run_ids: list[str]) -> list[RunTouch]:
        """Every engagement the tree's runs recorded, refusals included."""
        if not run_ids:
            return []
        stmt = select(RunTouch).where(RunTouch.run_id.in_(run_ids)).order_by(RunTouch.run_id, RunTouch.seq)
        return list((await session.execute(stmt)).scalars().all())
