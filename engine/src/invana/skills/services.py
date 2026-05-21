"""Service layer for Skill CRUD."""

from __future__ import annotations

from http import HTTPStatus

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

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


async def create_skill(session: AsyncSession, *, graph_id: str, payload: SkillCreate) -> Skill:
    skill = Skill(
        graph_id=graph_id,
        name=payload.name,
        description=payload.description,
        content=payload.content,
        when_to_use=payload.when_to_use,
    )
    try:
        return await SkillStore().add(session, skill)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=HTTPStatus.CONFLICT,
            detail=f"A skill named '{payload.name}' already exists in this Graph.",
        ) from exc


async def update_skill(session: AsyncSession, *, skill: Skill, payload: SkillUpdate) -> Skill:
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
    return skill


async def delete_skill(session: AsyncSession, *, skill: Skill) -> None:
    await SkillStore().delete(session, skill)
