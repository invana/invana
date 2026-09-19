"""Skill rules — create, update, delete, and the events each one emits.

This is the Python API for Skills. ``server/skills/views.py`` and the CLI both
call it and neither adds a rule of its own (migration-plan §6).

Three things this file deliberately does not do, each a rule from §4.1:

- **no ``fastapi`` import** — it raises ``NotFoundError`` / ``ConflictError``
  and the edge maps them to 404 / 409;
- **no ``select()``** — every query goes through ``SkillQuerySet``;
- **no ``session.commit()``** — the request owns the transaction (§18.1).
"""

from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.skills.models import Skill
from invana.apps.skills.querysets import SkillQuerySet
from invana.apps.skills.schemas import SkillCreate, SkillUpdate
from invana.core.errors import ConflictError, NotFoundError
from invana.core.events import actions
from invana.core.events.services import current_trace_id, diff_changed_fields, emit_event

_TRACKED = ["name", "description", "content", "when_to_use"]


class SkillManager:
    """Stateless. The session is the first argument of every method."""

    querysets = SkillQuerySet()

    async def list_for_graph(self, session: AsyncSession, *, graph_id: str) -> list[Skill]:
        return await self.querysets.list_for_graph(session, graph_id)

    async def get(self, session: AsyncSession, *, skill_id: str, graph_id: str) -> Skill:
        """Fetch one Skill, scoped to its Graph.

        A Skill in another Graph reads as absent rather than forbidden — the
        caller must not learn that the id exists.
        """
        skill = await self.querysets.get(session, skill_id)
        if skill is None or skill.graph_id != graph_id:
            raise NotFoundError("Skill not found.")
        return skill

    async def create(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        payload: SkillCreate,
        actor_id: str,
    ) -> Skill:
        skill = Skill(
            graph_id=graph_id,
            name=payload.name,
            description=payload.description,
            content=payload.content,
            when_to_use=payload.when_to_use,
        )
        try:
            await self.querysets.add(session, skill)
        except IntegrityError as exc:
            raise ConflictError(f"A skill named '{payload.name}' already exists in this Graph.") from exc
        await emit_event(
            session,
            action=actions.SKILL_CREATE,
            target_kind=actions.TARGET_SKILL,
            target_id=skill.id,
            graph_id=graph_id,
            actor_id=actor_id,
            details={"name": skill.name},
            trace_id=current_trace_id(),
        )
        return skill

    async def update(
        self,
        session: AsyncSession,
        *,
        skill: Skill,
        payload: SkillUpdate,
        actor_id: str,
    ) -> Skill:
        before = {f: getattr(skill, f) for f in _TRACKED}
        for field in _TRACKED:
            value = getattr(payload, field)
            if value is not None:
                setattr(skill, field, value)
        try:
            await session.flush()
        except IntegrityError as exc:
            raise ConflictError(f"A skill named '{skill.name}' already exists in this Graph.") from exc

        changed = diff_changed_fields(before, {f: getattr(skill, f) for f in _TRACKED}, fields=_TRACKED)
        if changed:
            await emit_event(
                session,
                action=actions.SKILL_UPDATE,
                target_kind=actions.TARGET_SKILL,
                target_id=skill.id,
                graph_id=skill.graph_id,
                actor_id=actor_id,
                details={"changed": changed, "name": skill.name},
                trace_id=current_trace_id(),
            )
        return skill

    async def delete(self, session: AsyncSession, *, skill: Skill, actor_id: str) -> None:
        # Read the fields before the row goes: the event outlives the subject
        # it describes (10.2 — "the subject's name is captured at write").
        name, graph_id, skill_id = skill.name, skill.graph_id, skill.id
        await self.querysets.delete(session, skill)
        await emit_event(
            session,
            action=actions.SKILL_DELETE,
            target_kind=actions.TARGET_SKILL,
            target_id=skill_id,
            graph_id=graph_id,
            actor_id=actor_id,
            details={"name": name},
            trace_id=current_trace_id(),
        )
