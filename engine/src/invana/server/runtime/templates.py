"""Projection templates — authoring the mapping from a shape to a surface.

A template is what stops the model from authoring markup
(docs/for-developers/modules/ask/features/projections.md P1), so it is authored
here, by a person, and versioned.

Two things this router refuses:

- **Editing a published version.** A published template is read-only; a change
  publishes the next version, exactly as a model version does. Otherwise an
  answer rendered last week could silently change shape.
- **Deleting a shipped template.** The five that come with the distribution have
  no Graph, and no Graph gets to remove them from every other one.

Routes
------
GET    /projection-templates              this Graph's templates, plus the shipped ones
POST   /projection-templates              author one
PATCH  /projection-templates/{id}         edit a draft
POST   /projection-templates/{id}/publish publish a draft
DELETE /projection-templates/{id}         remove one of this Graph's own
GET    /projection-templates/{id}/usage   every emission it rendered
"""

from __future__ import annotations

from http import HTTPStatus
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph, GraphMember
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.events import actions as event_actions
from invana.core.events.services import emit_event
from invana.runtime.models import Emission, ProjectionTemplate
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug
from invana.server.schemas import ActionResponse, action

templates_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}", tags=["projection-templates"])

SURFACES = (
    "choice",
    "multi-choice",
    "boolean",
    "pick-from-graph",
    "value",
    "confirm",
    "table",
    "metric",
    "chart",
    "subgraph",
    "markdown",
    "html",
)


class TemplateCreate(BaseModel):
    name: str
    kind: Literal["prompt", "result"] = "result"
    surface: str
    accepts: dict = Field(default_factory=dict)
    spec: dict = Field(default_factory=dict)
    intent: str = ""


class TemplateUpdate(BaseModel):
    name: str | None = None
    surface: str | None = None
    accepts: dict | None = None
    spec: dict | None = None
    intent: str | None = None


class TemplateRead(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    graph_id: str | None
    name: str
    kind: str
    surface: str
    accepts: dict
    spec: dict
    intent: str
    version: int
    status: str
    # How many emissions this template has rendered — the usage a promotion is
    # argued from (P7).
    used: int = 0
    # A shipped template belongs to no Graph, and no Graph may delete it.
    shipped: bool = False


async def _get_or_404(session: AsyncSession, graph_id: str, template_id: str) -> ProjectionTemplate:
    stmt = select(ProjectionTemplate).where(ProjectionTemplate.id == template_id)
    template = (await session.execute(stmt)).scalar_one_or_none()
    if template is None or (template.graph_id is not None and template.graph_id != graph_id):
        raise HTTPException(HTTPStatus.NOT_FOUND, detail={"error": "template_not_found", "template_id": template_id})
    return template


async def _usage(session: AsyncSession, template_ids: list[str]) -> dict[str, int]:
    if not template_ids:
        return {}
    stmt = (
        select(Emission.template_id, func.count(Emission.id))
        .where(Emission.template_id.in_(template_ids))
        .group_by(Emission.template_id)
    )
    return {row[0]: row[1] for row in (await session.execute(stmt)).all()}


def _read(template: ProjectionTemplate, used: int) -> TemplateRead:
    out = TemplateRead.model_validate(template)
    out.used = used
    out.shipped = template.graph_id is None
    return out


@templates_router.get("/projection-templates", response_model=list[TemplateRead])
async def list_templates(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> list[TemplateRead]:
    stmt = (
        select(ProjectionTemplate)
        .where(or_(ProjectionTemplate.graph_id == graph.id, ProjectionTemplate.graph_id.is_(None)))
        .order_by(ProjectionTemplate.kind, ProjectionTemplate.name)
    )
    rows = list((await session.execute(stmt)).scalars().all())
    used = await _usage(session, [row.id for row in rows])
    return [_read(row, used.get(row.id, 0)) for row in rows]


@templates_router.post(
    "/projection-templates",
    response_model=ActionResponse[TemplateRead],
    status_code=status.HTTP_201_CREATED,
)
async def create_template(
    payload: TemplateCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[TemplateRead]:
    if payload.surface not in SURFACES:
        raise HTTPException(
            HTTPStatus.UNPROCESSABLE_ENTITY,
            detail={"error": "unknown_surface", "surface": payload.surface, "known": list(SURFACES)},
        )
    template = ProjectionTemplate(
        graph_id=graph.id,
        name=payload.name,
        kind=payload.kind,
        surface=payload.surface,
        accepts=payload.accepts,
        spec=payload.spec,
        intent=payload.intent,
        # Authored as a draft: a template nobody has looked at should not be
        # competing to render answers yet.
        status="draft",
    )
    session.add(template)
    await session.flush()
    await emit_event(
        session,
        action=event_actions.PROJECTION_TEMPLATE_CREATE,
        target_kind=event_actions.TARGET_PROJECTION_TEMPLATE,
        target_id=template.id,
        graph_id=graph.id,
        actor_id=user.id,
        details={"name": template.name, "surface": template.surface},
    )
    await session.commit()
    return action(f'"{template.name}" saved as a draft — publish it to start rendering with it.', _read(template, 0))


@templates_router.patch("/projection-templates/{template_id}", response_model=ActionResponse[TemplateRead])
async def update_template(
    payload: TemplateUpdate,
    template_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[TemplateRead]:
    template = await _get_or_404(session, graph.id, template_id)
    if template.graph_id is None:
        raise HTTPException(
            HTTPStatus.CONFLICT,
            detail={
                "error": "template_is_shipped",
                "message": "This template ships with Invana. Copy it into this Graph to change it.",
            },
        )
    if template.status == "published":
        raise HTTPException(
            HTTPStatus.CONFLICT,
            detail={
                "error": "template_is_published",
                "message": "A published template is read-only — an answer rendered with it must not change shape. "
                "Publish a new version instead.",
            },
        )
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(template, field, value)
    await session.commit()
    used = await _usage(session, [template.id])
    return action(f'"{template.name}" updated.', _read(template, used.get(template.id, 0)))


@templates_router.post("/projection-templates/{template_id}/publish", response_model=ActionResponse[TemplateRead])
async def publish_template(
    template_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[TemplateRead]:
    """A draft becomes published and read-only, exactly as a model version does."""
    template = await _get_or_404(session, graph.id, template_id)
    if template.status == "published":
        raise HTTPException(HTTPStatus.CONFLICT, detail={"error": "already_published", "template_id": template_id})
    template.status = "published"
    await emit_event(
        session,
        action=event_actions.PROJECTION_TEMPLATE_PUBLISH,
        target_kind=event_actions.TARGET_PROJECTION_TEMPLATE,
        target_id=template.id,
        graph_id=graph.id,
        actor_id=user.id,
        details={"name": template.name, "version": template.version},
    )
    await session.commit()
    used = await _usage(session, [template.id])
    return action(
        f'"{template.name}" v{template.version} published — it will be offered wherever the shape fits.',
        _read(template, used.get(template.id, 0)),
    )


@templates_router.delete("/projection-templates/{template_id}", response_model=ActionResponse[None])
async def delete_template(
    template_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[None]:
    template = await _get_or_404(session, graph.id, template_id)
    if template.graph_id is None:
        raise HTTPException(
            HTTPStatus.CONFLICT,
            detail={
                "error": "template_is_shipped",
                "message": "This template ships with Invana and belongs to every Graph.",
            },
        )
    used = (await _usage(session, [template.id])).get(template.id, 0)
    if used:
        raise HTTPException(
            HTTPStatus.CONFLICT,
            detail={
                "error": "template_in_use",
                "used": used,
                "message": f"{used} answer{'' if used == 1 else 's'} were rendered with this. "
                "Removing it would leave them citing a template that no longer exists.",
            },
        )
    await session.delete(template)
    await emit_event(
        session,
        action=event_actions.PROJECTION_TEMPLATE_DELETE,
        target_kind=event_actions.TARGET_PROJECTION_TEMPLATE,
        target_id=template_id,
        graph_id=graph.id,
        actor_id=user.id,
        details={"name": template.name},
    )
    await session.commit()
    return action("Template removed.", None)
