"""Queries against ``skills``.

A queryset answers *which rows*, never *whether* — no permission check, no
HTTP type, no event. Stateless: the session is the first argument of every
method (migration-plan §5).
"""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.skills.models import Skill
from invana.core.lists import ListParams, PageInfo
from invana.core.lists.querysets import contains, page_of_select


class SkillQuerySet:
    async def list_for_graph(self, session: AsyncSession, graph_id: str) -> list[Skill]:
        """Every skill in the Graph by name, for code that reads them all — a bind check, the CLI."""
        stmt = select(Skill).where(Skill.graph_id == graph_id).order_by(Skill.name)
        return list((await session.execute(stmt)).scalars().all())

    async def page_for_graph(
        self, session: AsyncSession, graph_id: str, *, params: ListParams
    ) -> tuple[Sequence[Skill], PageInfo]:
        """One page of the Graph's skills.

        ``status=draft`` is a skill with no current version; ``published`` one
        with. Both at once is every skill, the same as neither.
        """
        unfiltered = select(Skill).where(Skill.graph_id == graph_id)
        stmt = unfiltered
        statuses = set(params.values("status"))
        if statuses == {"published"}:
            stmt = stmt.where(Skill.current_version_id.is_not(None))
        elif statuses == {"draft"}:
            stmt = stmt.where(Skill.current_version_id.is_(None))
        if origins := params.values("origin"):
            stmt = stmt.where(Skill.origin.in_(origins))
        if params.q:
            stmt = stmt.where(contains(params.q, Skill.name))
        return await page_of_select(
            session,
            stmt,
            params,
            unfiltered=unfiltered,
            sorts={"name": Skill.name, "updated_at": Skill.updated_at, "created_at": Skill.created_at},
            id_column=Skill.id,
        )

    async def by_name(self, session: AsyncSession, *, graph_id: str, name: str) -> Skill | None:
        """One skill by its name, which is unique per Graph.

        What the seeder matches on: a person who renamed the builtin playbook
        has made it theirs, and a second copy beside it would be the product
        arguing with them ([SK25](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
        """
        stmt = select(Skill).where(Skill.graph_id == graph_id, Skill.name == name)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def get(self, session: AsyncSession, skill_id: str) -> Skill | None:
        stmt = select(Skill).where(Skill.id == skill_id)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def add(self, session: AsyncSession, skill: Skill) -> Skill:
        session.add(skill)
        await session.flush()
        return skill

    async def delete(self, session: AsyncSession, skill: Skill) -> None:
        await session.delete(skill)
