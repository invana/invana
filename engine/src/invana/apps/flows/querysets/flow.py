"""Queries against ``flows`` and ``tasks``."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.flows.models import Flow, PlanOrigin, Task
from invana.core.lists import ListParams, PageInfo
from invana.core.lists.querysets import contains, page_of_select


class FlowQuerySet:
    async def get(self, session: AsyncSession, plan_id: str) -> Flow | None:
        return await session.get(Flow, plan_id)

    async def list_for_graph(self, session: AsyncSession, *, graph_id: str, reusable_only: bool = True) -> list[Flow]:
        """The library.

        ``reusable_only`` is the default because a generated one-off plan
        belongs to its Todo and is read from the run that ran it — listing it
        would make the library a log ([LB6](docs/for-developers/modules/workflows/features/the-library.md)).
        """
        stmt = select(Flow).where(Flow.graph_id == graph_id)
        if reusable_only:
            stmt = stmt.where(Flow.reusable.is_(True))
        stmt = stmt.order_by(Flow.key, Flow.version.desc())
        return list((await session.execute(stmt)).scalars().all())

    async def page_for_graph(
        self, session: AsyncSession, *, graph_id: str, params: ListParams
    ) -> tuple[Sequence[Flow], PageInfo]:
        """One page of the library's version rows — reusable plans only, as the library lists.

        ``family`` matches a key that is the family or starts with it and a
        dash, so ``nl`` takes ``nl`` and ``nl-compare`` but not ``nlx``.
        """
        unfiltered = select(Flow).where(Flow.graph_id == graph_id, Flow.reusable.is_(True))
        stmt = unfiltered
        if origins := params.values("origin"):
            stmt = stmt.where(Flow.origin.in_(origins))
        if families := params.values("family"):
            stmt = stmt.where(or_(*(or_(Flow.key == f, Flow.key.like(f"{f}-%")) for f in families)))
        if params.q:
            stmt = stmt.where(contains(params.q, Flow.name, Flow.key))
        return await page_of_select(
            session,
            stmt,
            params,
            unfiltered=unfiltered,
            sorts={"key": Flow.key, "name": Flow.name, "created_at": Flow.created_at},
            id_column=Flow.id,
        )

    async def count_packaged(self, session: AsyncSession, *, graph_id: str) -> int:
        """How many of the library's version rows came with Invana or a plugin."""
        stmt = select(func.count()).where(
            Flow.graph_id == graph_id,
            Flow.reusable.is_(True),
            Flow.origin == PlanOrigin.packaged.value,
        )
        return int((await session.execute(stmt)).scalar_one())

    async def find_by_key(self, session: AsyncSession, *, graph_id: str, key: str, version: int | None) -> Flow | None:
        """The named version, or the newest when ``version`` is ``None``."""
        stmt = select(Flow).where(Flow.graph_id == graph_id, Flow.key == key)
        if version is not None:
            stmt = stmt.where(Flow.version == version)
        return (await session.execute(stmt.order_by(Flow.version.desc()))).scalars().first()

    async def key_versions(self, session: AsyncSession, *, graph_id: str) -> set[tuple[str, int]]:
        stmt = select(Flow.key, Flow.version).where(Flow.graph_id == graph_id)
        return {(key, version) for key, version in (await session.execute(stmt)).all() if key}

    async def plans_without_nodes(self, session: AsyncSession, *, graph_id: str) -> dict[tuple[str, int], str]:
        """``(key, version) → plan_id`` for library rows that have no nodes.

        A plan **is** its rows, so a row with none is not a plan anybody can
        read or run. Migration ``000000000038`` carries the library across and
        drops ``spec``, trusting a seeded entry to rebuild itself from the
        registry — which it can only do if the rebuild can tell *exists* from
        *exists and is populated*. Identity alone cannot, because the carried
        row keeps its key and version.
        """
        stmt = (
            select(Flow.key, Flow.version, Flow.id)
            .outerjoin(Task, Task.flow_id == Flow.id)
            .where(Flow.graph_id == graph_id)
            .group_by(Flow.key, Flow.version, Flow.id)
            .having(func.count(Task.id) == 0)
        )
        return {(key, version): plan_id for key, version, plan_id in (await session.execute(stmt)).all() if key}

    async def step_key_usage(self, session: AsyncSession, *, graph_id: str) -> dict[str, int]:
        """step_key → how many reusable plans in the Graph name it, counted once per plan key."""
        rows = await session.execute(
            select(Task.step_key, func.count(func.distinct(Flow.key)))
            .join(Flow, Task.flow_id == Flow.id)
            .where(
                Flow.graph_id == graph_id,
                Flow.reusable.is_(True),
                Flow.key.is_not(None),
                Task.step_key.is_not(None),
            )
            .group_by(Task.step_key)
        )
        return {step_key: int(count) for step_key, count in rows.all()}

    async def latest_version(self, session: AsyncSession, *, graph_id: str, key: str) -> int | None:
        stmt = (
            select(Flow.version)
            .where(Flow.graph_id == graph_id, Flow.key == key)
            .order_by(Flow.version.desc())
            .limit(1)
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def versions_of(self, session: AsyncSession, *, graph_id: str, key: str) -> list[Flow]:
        stmt = select(Flow).where(Flow.graph_id == graph_id, Flow.key == key).order_by(Flow.version)
        return list((await session.execute(stmt)).scalars().all())

    async def plans_inlining(self, session: AsyncSession, *, graph_id: str, ref: str) -> list[str]:
        """The plans that copied *ref*'s rows — ``tasks.source_plan_key`` names it."""
        stmt = (
            select(Task.flow_id)
            .join(Flow, Flow.id == Task.flow_id)
            .where(Flow.graph_id == graph_id, Task.source_plan_key == ref)
            .distinct()
        )
        return list((await session.execute(stmt)).scalars().all())

    async def copied_steps(self, session: AsyncSession, *, graph_id: str, ref: str) -> dict[str, dict[str, str]]:
        """Per plan that copied *ref*: each copied row's key → the step of *ref* it came from.

        Only a plan whose **every** copied row names its source is returned. A
        row with no ``source_step_key`` was copied before the column existed,
        its key is not evidence, and half a copy read step by step would say
        the other half was never reached
        ([LB36](docs/for-developers/modules/workflows/features/the-library.md)).
        """
        stmt = (
            select(Task.flow_id, Task.key, Task.source_step_key)
            .join(Flow, Flow.id == Task.flow_id)
            .where(Flow.graph_id == graph_id, Task.source_plan_key == ref)
        )
        copies: dict[str, dict[str, str | None]] = {}
        for plan_id, key, source in (await session.execute(stmt)).all():
            copies.setdefault(plan_id, {})[key] = source
        return {
            plan_id: {key: source for key, source in rows.items() if source}
            for plan_id, rows in copies.items()
            if all(rows.values())
        }

    async def add(self, session: AsyncSession, plan: Flow) -> Flow:
        session.add(plan)
        await session.flush()
        return plan

    # ── The nodes ──────────────────────────────────────────────────────────
    async def tasks_for(self, session: AsyncSession, *, plan_id: str) -> list[Task]:
        stmt = select(Task).where(Task.flow_id == plan_id).order_by(Task.ordinal, Task.key)
        return list((await session.execute(stmt)).scalars().all())

    async def tasks_for_plans(self, session: AsyncSession, *, plan_ids: list[str]) -> dict[str, list[Task]]:
        """Every plan's nodes in one query — the list view needs a count per row."""
        if not plan_ids:
            return {}
        stmt = select(Task).where(Task.flow_id.in_(plan_ids)).order_by(Task.ordinal, Task.key)
        out: dict[str, list[Task]] = {}
        for task in (await session.execute(stmt)).scalars().all():
            out.setdefault(task.flow_id, []).append(task)
        return out

    async def add_tasks(self, session: AsyncSession, tasks: list[Task]) -> list[Task]:
        session.add_all(tasks)
        await session.flush()
        return tasks

    async def clear_tasks(self, session: AsyncSession, *, plan_id: str) -> None:
        await session.execute(delete(Task).where(Task.flow_id == plan_id))
