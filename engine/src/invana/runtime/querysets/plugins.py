"""Queries against ``plugin_states`` and ``envelope_outcomes``, and how often a task type ran."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.runtime.models import EnvelopeOutcome, PluginState, TaskRun


class TaskTypeUsageQuerySet:
    async def runs_since(self, session: AsyncSession, *, key: str, since: datetime) -> int:
        """Run nodes queued since ``since`` that named ``key``, at any version."""
        named = or_(TaskRun.task_key == key, TaskRun.task_key.startswith(f"{key}@", autoescape=True))
        count = await session.scalar(select(func.count()).select_from(TaskRun).where(named, TaskRun.queued_at >= since))
        return int(count or 0)


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
