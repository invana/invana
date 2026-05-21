"""Service layer for Skill CRUD."""

from __future__ import annotations

from http import HTTPStatus

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from invana.events import actions
from invana.events.services import current_trace_id, diff_changed_fields, emit_event
from invana.skills.models import Skill
from invana.skills.schemas import SkillCreate, SkillUpdate
from invana.skills.store import SkillStore


async def list_skills(session: AsyncSession, *, graph_id: str) -> list[Skill]:
    return await SkillStore().list_for_graph(session, graph_id)


async def get_or_404(session: AsyncSession, *, skill_id: str, graph_id: str) -> Skill:
    skill = await SkillStore().get(session, skill_id)
    if skill is None or skill.graph_id != graph_id:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="Skill not found.")
    return skill


async def create_skill(
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
        await SkillStore().add(session, skill)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=HTTPStatus.CONFLICT,
            detail=f"A skill named '{payload.name}' already exists in this Graph.",
        ) from exc
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


async def update_skill(
    session: AsyncSession,
    *,
    skill: Skill,
    payload: SkillUpdate,
    actor_id: str,
) -> Skill:
    before = {
        "name": skill.name,
        "description": skill.description,
        "content": skill.content,
        "when_to_use": skill.when_to_use,
    }
    if payload.name is not None:
        skill.name = payload.name
    if payload.description is not None:
        skill.description = payload.description
    if payload.content is not None:
        skill.content = payload.content
    if payload.when_to_use is not None:
        skill.when_to_use = payload.when_to_use
    try:
        await session.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=HTTPStatus.CONFLICT,
            detail=f"A skill named '{skill.name}' already exists in this Graph.",
        ) from exc
    after = {
        "name": skill.name,
        "description": skill.description,
        "content": skill.content,
        "when_to_use": skill.when_to_use,
    }
    changed = diff_changed_fields(before, after, fields=["name", "description", "content", "when_to_use"])
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


async def delete_skill(
    session: AsyncSession,
    *,
    skill: Skill,
    actor_id: str,
) -> None:
    name = skill.name
    graph_id = skill.graph_id
    skill_id = skill.id
    await SkillStore().delete(session, skill)
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
