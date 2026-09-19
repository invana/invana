"""HTTP views for Skills.

Each one parses the request, calls **one** manager method, and serialises the
result. No rule, no query, no commit, no event (migration-plan §4.1) — so every
handler here is a couple of lines, and the part worth testing lives in
``apps/skills/managers``.

Status codes come from ``core.errors`` through the handlers in
``server/app.py``: ``NotFoundError`` → 404, ``ConflictError`` → 409.

There is no ``server/skills/deps.py``: Skills has no dependency of its own. It
reuses the shared ones under their existing names.
"""

from __future__ import annotations

from fastapi import Depends, Path, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.schemas import SkillUsageResponse
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.skills.managers import SkillManager
from invana.apps.skills.schemas import (
    SkillCreate,
    SkillListResponse,
    SkillRead,
    SkillUpdate,
    SkillVersionDiff,
    SkillVersionListResponse,
    SkillVersionPublish,
    SkillVersionRead,
)
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.runtime.managers import SkillUsageManager
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

skills = SkillManager()
usage = SkillUsageManager()


async def list_skills(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SkillListResponse:
    items = await skills.list_for_graph(session, graph_id=graph.id)
    reads = [SkillRead.model_validate(s) for s in items]
    return SkillListResponse(items=reads, total=len(reads))


async def create_skill(
    payload: SkillCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SkillRead:
    skill = await skills.create(session, graph_id=graph.id, payload=payload, actor_id=user.id)
    return SkillRead.model_validate(skill)


async def get_skill(
    skill_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SkillRead:
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    return SkillRead.model_validate(skill)


async def update_skill(
    payload: SkillUpdate,
    skill_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SkillRead:
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    updated = await skills.update(session, skill=skill, payload=payload, actor_id=user.id)
    return SkillRead.model_validate(updated)


async def delete_skill(
    skill_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    await skills.delete(session, skill=skill, actor_id=user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def list_skill_versions(
    skill_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SkillVersionListResponse:
    """Every published version, newest first.

    A published version is immutable, so this is a history rather than a list of
    drafts — the one at the top is what the next run is offered.
    """
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    items = await skills.list_versions(session, skill=skill)
    reads = [SkillVersionRead.model_validate(v) for v in items]
    return SkillVersionListResponse(items=reads, total=len(reads))


async def publish_skill_version(
    payload: SkillVersionPublish,
    skill_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SkillVersionRead:
    """Publish the next version. Fields left out carry over from the current one."""
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    version = await skills.publish(session, skill=skill, payload=payload, actor_id=user.id)
    return SkillVersionRead.model_validate(version)


async def get_skill_version(
    skill_id: str = Path(...),
    version: int = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SkillVersionRead:
    """One version by its number — what a step that named it was actually offered."""
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    return SkillVersionRead.model_validate(await skills.get_version(session, skill=skill, version=version))


async def diff_skill_version(
    skill_id: str = Path(...),
    version: int = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SkillVersionDiff:
    """What this version changed against the one before it.

    Unified diff lines per field. `v1` diffs against nothing rather than against
    empty text — a first version did not delete anything.
    """
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    return await skills.diff_version(session, skill=skill, version=version)


async def skill_usage(
    skill_id: str = Path(...),
    limit: int = 25,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SkillUsageResponse:
    """Where this skill is carried, and where it was offered or reported.

    Two levels, labelled honestly (docs/for-developers/modules/work/spec.md): *offered* is a fact written
    by prompt assembly; *reported* is the model saying it followed the prose.
    ``reported`` on a row is the difference, and the badge says so.
    """
    # A view's docstring is published as the endpoint `description` in the
    # OpenAPI schema, so it is part of the API contract — it stays here even
    # when the logic it describes moves to a manager.
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    return await usage.for_skill(session, skill=skill, graph_id=graph.id, limit=limit)
