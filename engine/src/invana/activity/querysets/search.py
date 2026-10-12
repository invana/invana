"""Name queries for search, one per kind, always inside the Graphs it is handed.

docs/for-developers/modules/platform/features/search.md. A queryset answers
*which rows*, never *whether*: the manager decides which Graph ids the reader
may see and passes them in, so no query here can reach past them.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent
from invana.apps.govern.models import Lens, LensKind
from invana.apps.graphs.models import Graph
from invana.apps.modeller.models import GraphModel
from invana.apps.skills.models import Skill
from invana.apps.work.models import Project
from invana.core.auth.models import User

# kind → (model, its name column, extra conditions)
_KINDS: dict[str, tuple[Any, Any, tuple[Any, ...]]] = {
    "model": (GraphModel, GraphModel.name, ()),
    "agent": (Agent, Agent.name, ()),
    "skill": (Skill, Skill.name, ()),
    "project": (Project, Project.name, ()),
    "world": (Lens, Lens.name, (Lens.kind == LensKind.world.value, Lens.name.is_not(None))),
    "guardrail": (Lens, Lens.name, (Lens.kind == LensKind.guardrail.value, Lens.name.is_not(None))),
}

KINDS: tuple[str, ...] = tuple(_KINDS)


def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class SearchQuerySet:
    async def named(
        self, session: AsyncSession, *, kind: str, graph_ids: list[str], needle: str, limit: int
    ) -> list[tuple[str, str, str]]:
        """``(id, name, graph_id)`` of ``kind`` rows whose name contains ``needle``
        (lower-cased), exact matches first, then prefixes, then the name."""
        if not graph_ids:
            return []
        model, name, extra = _KINDS[kind]
        lowered = func.lower(name)
        escaped = _escape(needle)
        rank = case((lowered == needle, 0), (lowered.like(f"{escaped}%", escape="\\"), 1), else_=2)
        stmt = (
            select(model.id, name, model.graph_id)
            .where(model.graph_id.in_(graph_ids), lowered.like(f"%{escaped}%", escape="\\"), *extra)
            .order_by(rank, lowered)
            .limit(limit)
        )
        return [(row[0], row[1], row[2]) for row in (await session.execute(stmt)).all()]

    async def graph_refs(self, session: AsyncSession, *, graph_ids: list[str]) -> dict[str, tuple[str, str]]:
        """``graph_id → (name, "<owner>/<slug>")`` for the Graphs named."""
        if not graph_ids:
            return {}
        stmt = (
            select(Graph.id, Graph.name, User.username, Graph.slug)
            .join(User, User.id == Graph.created_by_id)
            .where(Graph.id.in_(graph_ids))
        )
        return {row[0]: (row[1], f"{row[2]}/{row[3]}") for row in (await session.execute(stmt)).all()}
