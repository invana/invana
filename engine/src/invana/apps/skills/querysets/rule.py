"""Queries against ``rules`` and ``rule_versions``.

A queryset answers *which rows*, never *whether* — no permission check, no
HTTP type, no event. Stateless: the session is the first argument of every
method (migration-plan §5).
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.skills.models import Rule, RuleVersion


class RuleQuerySet:
    async def get(self, session: AsyncSession, rule_id: str) -> Rule | None:
        return (await session.execute(select(Rule).where(Rule.id == rule_id))).scalar_one_or_none()

    async def invariants(self, session: AsyncSession, *, graph_id: str, active_only: bool = False) -> list[Rule]:
        """A Graph's own rules — ``project_id IS NULL``."""
        stmt = select(Rule).where(Rule.graph_id == graph_id, Rule.project_id.is_(None))
        if active_only:
            stmt = stmt.where(Rule.active.is_(True))
        return list((await session.execute(stmt.order_by(Rule.order, Rule.created_at))).scalars().all())

    async def working(self, session: AsyncSession, *, project_id: str, active_only: bool = False) -> list[Rule]:
        stmt = select(Rule).where(Rule.project_id == project_id)
        if active_only:
            stmt = stmt.where(Rule.active.is_(True))
        return list((await session.execute(stmt.order_by(Rule.order, Rule.created_at))).scalars().all())

    async def next_order(self, session: AsyncSession, *, graph_id: str, project_id: str | None) -> int:
        """One past the highest in the same list, so a new rule lands at the end."""
        stmt = select(func.max(Rule.order)).where(Rule.graph_id == graph_id)
        stmt = stmt.where(Rule.project_id == project_id) if project_id else stmt.where(Rule.project_id.is_(None))
        return ((await session.execute(stmt)).scalar_one_or_none() or 0) + 1

    async def add(self, session: AsyncSession, rule: Rule) -> Rule:
        session.add(rule)
        await session.flush()
        return rule


class RuleVersionQuerySet:
    async def list_for_rule(self, session: AsyncSession, rule_id: str) -> list[RuleVersion]:
        stmt = select(RuleVersion).where(RuleVersion.rule_id == rule_id).order_by(RuleVersion.version.desc())
        return list((await session.execute(stmt)).scalars().all())

    async def statements_by_id(self, session: AsyncSession, version_ids: list[str]) -> dict[str, tuple[str, str]]:
        """``rule_version_id`` → ``(rule_id, statement)``, for the ids a step recorded.

        One query for a whole tree or trace, rather than one per row. The
        version's wording, and the rule beside it: a step row shows the
        statement it was given and opens the rule
        ([RU12](docs/for-developers/modules/skills/features/rules.md)).
        """
        if not version_ids:
            return {}
        stmt = select(RuleVersion.id, RuleVersion.rule_id, RuleVersion.statement).where(RuleVersion.id.in_(version_ids))
        return {row[0]: (row[1], row[2]) for row in (await session.execute(stmt)).all()}

    async def get_by_number(self, session: AsyncSession, rule_id: str, version: int) -> RuleVersion | None:
        stmt = select(RuleVersion).where(RuleVersion.rule_id == rule_id, RuleVersion.version == version)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def highest_version(self, session: AsyncSession, rule_id: str) -> int:
        stmt = select(func.max(RuleVersion.version)).where(RuleVersion.rule_id == rule_id)
        return (await session.execute(stmt)).scalar_one_or_none() or 0

    async def add(self, session: AsyncSession, version: RuleVersion) -> RuleVersion:
        session.add(version)
        await session.flush()
        return version
