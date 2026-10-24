"""Queries against ``plugin_states``, ``envelope_outcomes``, ``mcp_servers`` — and a function's use in a Graph."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy import exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from invana.apps.flows.models import Flow, Task
from invana.apps.skills.models import Skill, SkillVersion
from invana.core.lists import ListParams, PageInfo
from invana.core.lists.querysets import page_of_select
from invana.runtime.models import EnvelopeOutcome, McpServer, PluginState, RunRole, TaskRun


def _names(key: str):
    """A step names ``key`` at any version: ``key`` or ``key@<version>``."""
    return or_(TaskRun.task_key == key, TaskRun.task_key.startswith(f"{key}@", autoescape=True))


class FunctionUsageQuerySet:
    """What a Graph did with one function: the steps that called it, the plans and skills that name it.

    A call is a step — a run with a parent — whose ``task_key`` names the
    function. Eval runs are left out: an eval case is a child run with
    ``role = evaluate`` and a skill test is a root with it, so a step whose
    parent carries that role was a replay, not a call anyone asked for.
    """

    @staticmethod
    def _calls(graph_id: str, key: str):
        parent = aliased(TaskRun)
        return (
            select(TaskRun)
            .join(parent, TaskRun.parent_run_id == parent.id)
            .where(TaskRun.graph_id == graph_id, _names(key), parent.role != RunRole.evaluate.value)
        )

    async def call_facts_since(
        self, session: AsyncSession, *, graph_id: str, key: str, since: datetime
    ) -> list[tuple[str, datetime, int | None, int | None, datetime | None]]:
        """``(status, queued_at, queue_ms, duration_ms, finished_at)`` of every call queued since ``since``."""
        calls = self._calls(graph_id, key).where(TaskRun.queued_at >= since).subquery()
        stmt = select(calls.c.status, calls.c.queued_at, calls.c.queue_ms, calls.c.duration_ms, calls.c.finished_at)
        return [tuple(row) for row in (await session.execute(stmt)).all()]

    async def page_calls(
        self, session: AsyncSession, *, graph_id: str, key: str, params: ListParams
    ) -> tuple[Sequence[TaskRun], PageInfo]:
        """One page of the calls, newest first; ``status`` filters."""
        unfiltered = self._calls(graph_id, key)
        stmt = unfiltered
        if statuses := params.values("status"):
            stmt = stmt.where(TaskRun.status.in_(statuses))
        return await page_of_select(
            session, stmt, params, unfiltered=unfiltered, sorts={"queued_at": TaskRun.queued_at}, id_column=TaskRun.id
        )

    async def runs_by_id(self, session: AsyncSession, run_ids: list[str]) -> dict[str, TaskRun]:
        if not run_ids:
            return {}
        rows = await session.scalars(select(TaskRun).where(TaskRun.id.in_(run_ids)))
        return {r.id: r for r in rows}

    async def plans_naming(self, session: AsyncSession, *, graph_id: str, key: str) -> list[Flow]:
        """The Graph's reusable plans with a step naming ``key`` — one per plan key, its newest version, by key."""
        named = (
            select(Flow.key, func.max(Flow.version).label("version"))
            .join(Task, Task.flow_id == Flow.id)
            .where(Flow.graph_id == graph_id, Flow.reusable.is_(True), Flow.key.is_not(None), Task.step_key == key)
            .group_by(Flow.key)
            .subquery()
        )
        stmt = (
            select(Flow)
            .join(named, (Flow.key == named.c.key) & (Flow.version == named.c.version))
            .where(Flow.graph_id == graph_id)
            .order_by(Flow.key)
        )
        return list(await session.scalars(stmt))

    async def skills_needing(self, session: AsyncSession, *, graph_id: str, key: str) -> list[tuple[Skill, int]]:
        """``(skill, version)`` for each skill in the Graph whose current version's plan names ``key``, by name."""
        stmt = (
            select(Skill, SkillVersion.version)
            .join(SkillVersion, Skill.current_version_id == SkillVersion.id)
            .where(
                Skill.graph_id == graph_id,
                exists().where(Task.flow_id == SkillVersion.plan_id, Task.step_key == key),
            )
            .order_by(Skill.name)
        )
        return [(skill, int(version)) for skill, version in (await session.execute(stmt)).all()]


class PluginStateQuerySet:
    async def enabled_names(self, session: AsyncSession) -> frozenset[str]:
        rows = await session.scalars(select(PluginState.name).where(PluginState.enabled.is_(True)))
        return frozenset(rows)

    async def get(self, session: AsyncSession, name: str) -> PluginState | None:
        return await session.get(PluginState, name)

    async def put(self, session: AsyncSession, *, name: str, enabled: bool, actor_id: str | None) -> PluginState:
        row = await session.get(PluginState, name)
        if row is None:
            row = PluginState(name=name)
            session.add(row)
        row.enabled, row.changed_by_id, row.changed_at = enabled, actor_id, datetime.now(UTC)
        await session.flush()
        return row


class EnvelopeOutcomeQuerySet:
    async def get(self, session: AsyncSession, idempotency_key: str) -> EnvelopeOutcome | None:
        return await session.get(EnvelopeOutcome, idempotency_key)

    async def add(self, session: AsyncSession, *, idempotency_key: str, run_id: str, outcome: dict) -> EnvelopeOutcome:
        row = EnvelopeOutcome(idempotency_key=idempotency_key, run_id=run_id, outcome=outcome)
        session.add(row)
        await session.flush()
        return row


class McpServerQuerySet:
    async def all(self, session: AsyncSession) -> list[McpServer]:
        return list(await session.scalars(select(McpServer).order_by(McpServer.name)))

    async def get(self, session: AsyncSession, name: str) -> McpServer | None:
        return await session.get(McpServer, name)

    async def add(self, session: AsyncSession, row: McpServer) -> McpServer:
        session.add(row)
        await session.flush()
        return row
