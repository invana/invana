"""Graph-model endpoints — graph-scoped under /u/{username}/{graphSlug}/models.

A Graph owns many **graph models** (persona-scoped; RFC-019). Each model has a
versioned type tree (node/edge types, property keys, constraints, indexes).
This router is thin plumbing over ``ModelStore`` (which already implements all
CRUD) + ``Versioner``.

Routes
------
GET    /                                   list the graph's models
POST   /                                   create a blank model (+ initial draft)
GET    /{model_id}                         model detail (+ versions)
PATCH  /{model_id}                         update name/description/persona/status
DELETE /{model_id}                         hard delete (cascades versions)
POST   /{model_id}/set-default             make this the graph's default model

GET    /{model_id}/versions                list versions
POST   /{model_id}/versions                create a draft (optional based_on)
GET    /{model_id}/active-version          active version (full tree)
GET    /{model_id}/versions/{vid}          a version (full tree)
POST   /{model_id}/versions/{vid}/activate activate a draft

# type authoring — only on a draft version (ModelStore._ensure_draft → 409)
POST/PATCH/DELETE /{model_id}/versions/{vid}/node-types[/{id}]
POST/DELETE       …/edge-types · …/property-keys · …/constraints · …/indexes
"""

from __future__ import annotations

from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.auth.deps import get_current_user
from invana.auth.models import User
from invana.db import get_session
from invana.events import actions as event_actions
from invana.events.services import emit_event
from invana.graphs.deps import (
    require_graph_builder,
    require_graph_member,
    resolve_graph_by_username_slug,
)
from invana.graphs.models import Graph, GraphMember
from invana.modeller.models import GraphModel, GraphVersion
from invana.modeller.schemas import (
    ConstraintCreate,
    ConstraintResponse,
    EdgeTypeCreate,
    EdgeTypeResponse,
    EdgeTypeUpdate,
    GraphModelCreate,
    GraphModelResponse,
    GraphModelSummary,
    GraphModelUpdate,
    IndexCreate,
    IndexResponse,
    NodeTypeCreate,
    NodeTypeResponse,
    NodeTypeUpdate,
    PropertyKeyCreate,
    PropertyKeyResponse,
    VersionActivate,
    VersionCreate,
    VersionResponse,
    VersionSummary,
)
from invana.modeller.store import ModelStore
from invana.modeller.versioner import Versioner

models_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/models", tags=["models"])

_store = ModelStore()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _active_summary(model: GraphModel) -> VersionSummary | None:
    active = next((v for v in model.versions if v.status == "active"), None)
    return VersionSummary.model_validate(active) if active else None


def _to_summary(model: GraphModel) -> GraphModelSummary:
    summary = GraphModelSummary.model_validate(model)
    summary.active_version = _active_summary(model)
    return summary


def _to_response(model: GraphModel) -> GraphModelResponse:
    resp = GraphModelResponse.model_validate(model)
    resp.active_version = _active_summary(model)
    return resp


async def _get_model_or_404(session: AsyncSession, graph_id: str, model_id: str) -> GraphModel:
    model = await _store.get_graph_model(session, model_id)
    if model is None or model.graph_id != graph_id:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail={"error": "model_not_found", "model_id": model_id})
    return model


async def _get_draft_version_or_404(
    session: AsyncSession, graph_id: str, model_id: str, version_id: str
) -> GraphVersion:
    await _get_model_or_404(session, graph_id, model_id)
    version = await _store.get_version(session, version_id)
    if version is None or version.model_id != model_id:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail={"error": "version_not_found", "version_id": version_id})
    if version.status != "draft":
        raise HTTPException(
            HTTPStatus.CONFLICT,
            detail={"error": "version_not_draft", "version_id": version_id, "status": version.status},
        )
    return version


def _conflict(exc: ValueError) -> HTTPException:
    return HTTPException(HTTPStatus.CONFLICT, detail={"error": "invalid_operation", "message": str(exc)})


async def _full_version(session: AsyncSession, version_id: str) -> VersionResponse:
    version = await _store.get_version(session, version_id)
    return VersionResponse.model_validate(version)


# ---------------------------------------------------------------------------
# Model lifecycle
# ---------------------------------------------------------------------------


@models_router.get("", response_model=list[GraphModelSummary])
async def list_models(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> list[GraphModelSummary]:
    models = await _store.list_graph_models(session, graph_id=graph.id)
    return [_to_summary(m) for m in models]


@models_router.post("", response_model=GraphModelResponse, status_code=status.HTTP_201_CREATED)
async def create_model(
    payload: GraphModelCreate,
    _: GraphMember = Depends(require_graph_builder),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GraphModelResponse:
    existing = await _store.list_graph_models(session, graph_id=graph.id)
    is_default = len(existing) == 0  # first model on the graph becomes default
    model = await _store.create_graph_model(
        session,
        name=payload.name,
        graph_id=graph.id,
        persona=payload.persona,
        is_default=is_default,
        description=payload.description,
        validation_mode=payload.validation_mode,
    )
    await _store.create_version(session, model_id=model.id)  # initial empty draft to author into
    await emit_event(
        session,
        action=event_actions.MODEL_CREATE,
        target_kind=event_actions.TARGET_MODEL,
        target_id=model.id,
        graph_id=graph.id,
        actor_id=user.id,
        details={"name": model.name, "persona": model.persona},
    )
    await session.commit()
    model = await _store.get_graph_model(session, model.id)
    return _to_response(model)


@models_router.get("/{model_id}", response_model=GraphModelResponse)
async def get_model(
    model_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> GraphModelResponse:
    model = await _get_model_or_404(session, graph.id, model_id)
    return _to_response(model)


@models_router.patch("/{model_id}", response_model=GraphModelResponse)
async def update_model(
    payload: GraphModelUpdate,
    model_id: str = Path(...),
    _: GraphMember = Depends(require_graph_builder),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GraphModelResponse:
    await _get_model_or_404(session, graph.id, model_id)
    await _store.update_graph_model(session, model_id, **payload.model_dump(exclude_unset=True))
    await emit_event(
        session,
        action=event_actions.MODEL_UPDATE,
        target_kind=event_actions.TARGET_MODEL,
        target_id=model_id,
        graph_id=graph.id,
        actor_id=user.id,
        details=payload.model_dump(exclude_unset=True),
    )
    await session.commit()
    model = await _store.get_graph_model(session, model_id)
    return _to_response(model)


@models_router.delete("/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model(
    model_id: str = Path(...),
    _: GraphMember = Depends(require_graph_builder),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await _get_model_or_404(session, graph.id, model_id)
    await _store.delete_graph_model(session, model_id)
    await emit_event(
        session,
        action=event_actions.MODEL_DELETE,
        target_kind=event_actions.TARGET_MODEL,
        target_id=model_id,
        graph_id=graph.id,
        actor_id=user.id,
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@models_router.post("/{model_id}/set-default", response_model=GraphModelResponse)
async def set_default_model(
    model_id: str = Path(...),
    _: GraphMember = Depends(require_graph_builder),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GraphModelResponse:
    await _get_model_or_404(session, graph.id, model_id)
    # Clear the existing default, then set this one (partial-unique also guards it).
    for other in await _store.list_graph_models(session, graph_id=graph.id):
        if other.is_default and other.id != model_id:
            await _store.update_graph_model(session, other.id, is_default=False)
    await _store.update_graph_model(session, model_id, is_default=True)
    await emit_event(
        session,
        action=event_actions.MODEL_SET_DEFAULT,
        target_kind=event_actions.TARGET_MODEL,
        target_id=model_id,
        graph_id=graph.id,
        actor_id=user.id,
    )
    await session.commit()
    model = await _store.get_graph_model(session, model_id)
    return _to_response(model)


# ---------------------------------------------------------------------------
# Versions
# ---------------------------------------------------------------------------


@models_router.get("/{model_id}/versions", response_model=list[VersionSummary])
async def list_versions(
    model_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> list[VersionSummary]:
    await _get_model_or_404(session, graph.id, model_id)
    versions = await _store.list_versions(session, model_id)
    return [VersionSummary.model_validate(v) for v in versions]


@models_router.post("/{model_id}/versions", response_model=VersionResponse, status_code=status.HTTP_201_CREATED)
async def create_draft_version(
    payload: VersionCreate,
    model_id: str = Path(...),
    _: GraphMember = Depends(require_graph_builder),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> VersionResponse:
    await _get_model_or_404(session, graph.id, model_id)
    try:
        version = await _store.create_version(session, model_id=model_id, based_on=payload.based_on)
    except ValueError as exc:
        raise _conflict(exc) from exc
    await session.commit()
    return await _full_version(session, version.id)


@models_router.get("/{model_id}/active-version", response_model=VersionResponse)
async def get_model_active_version(
    model_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> VersionResponse:
    await _get_model_or_404(session, graph.id, model_id)
    version = await _store.get_active_version(session, model_id)
    if version is None:  # fall back to the latest version regardless of status
        versions = await _store.list_versions(session, model_id)
        version = await _store.get_version(session, versions[-1].id) if versions else None
    if version is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail={"error": "no_version", "model_id": model_id})
    return VersionResponse.model_validate(version)


@models_router.get("/{model_id}/versions/{version_id}", response_model=VersionResponse)
async def get_version(
    model_id: str = Path(...),
    version_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> VersionResponse:
    await _get_model_or_404(session, graph.id, model_id)
    version = await _store.get_version(session, version_id)
    if version is None or version.model_id != model_id:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail={"error": "version_not_found", "version_id": version_id})
    return VersionResponse.model_validate(version)


@models_router.post("/{model_id}/versions/{version_id}/activate", response_model=VersionResponse)
async def activate_version(
    payload: VersionActivate,
    model_id: str = Path(...),
    version_id: str = Path(...),
    _: GraphMember = Depends(require_graph_builder),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> VersionResponse:
    await _get_model_or_404(session, graph.id, model_id)
    try:
        activated = await Versioner(_store).activate(session, version_id=version_id, override_version=payload.version)
    except ValueError as exc:
        raise _conflict(exc) from exc
    await emit_event(
        session,
        action=event_actions.MODEL_ACTIVATE,
        target_kind=event_actions.TARGET_MODEL,
        target_id=model_id,
        graph_id=graph.id,
        actor_id=user.id,
        details={"version": activated.version},
    )
    await session.commit()
    return await _full_version(session, activated.id)


# ---------------------------------------------------------------------------
# Type authoring (draft versions only)
# ---------------------------------------------------------------------------


@models_router.post(
    "/{model_id}/versions/{version_id}/node-types",
    response_model=NodeTypeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_node_type(
    payload: NodeTypeCreate,
    model_id: str = Path(...),
    version_id: str = Path(...),
    _: GraphMember = Depends(require_graph_builder),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> NodeTypeResponse:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    try:
        node_type = await _store.create_node_type(
            session,
            version_id=version_id,
            name=payload.name,
            description=payload.description,
            parent_type=payload.parent_type,
            is_abstract=payload.is_abstract,
            validation_mode=payload.validation_mode,
            property_mappings=[m.model_dump() for m in payload.property_mappings],
        )
    except ValueError as exc:
        raise _conflict(exc) from exc
    await session.commit()
    return NodeTypeResponse.model_validate(node_type)


@models_router.patch(
    "/{model_id}/versions/{version_id}/node-types/{type_id}",
    response_model=NodeTypeResponse,
)
async def update_node_type(
    payload: NodeTypeUpdate,
    model_id: str = Path(...),
    version_id: str = Path(...),
    type_id: str = Path(...),
    _: GraphMember = Depends(require_graph_builder),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> NodeTypeResponse:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    try:
        node_type = await _store.update_node_type(session, type_id, **payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise _conflict(exc) from exc
    if node_type is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail={"error": "node_type_not_found", "id": type_id})
    await session.commit()
    return NodeTypeResponse.model_validate(node_type)


@models_router.delete(
    "/{model_id}/versions/{version_id}/node-types/{type_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_node_type(
    model_id: str = Path(...),
    version_id: str = Path(...),
    type_id: str = Path(...),
    _: GraphMember = Depends(require_graph_builder),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    try:
        await _store.delete_node_type(session, type_id)
    except ValueError as exc:
        raise _conflict(exc) from exc
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@models_router.post(
    "/{model_id}/versions/{version_id}/edge-types",
    response_model=EdgeTypeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_edge_type(
    payload: EdgeTypeCreate,
    model_id: str = Path(...),
    version_id: str = Path(...),
    _: GraphMember = Depends(require_graph_builder),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> EdgeTypeResponse:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    try:
        edge_type = await _store.create_edge_type(
            session,
            version_id=version_id,
            name=payload.name,
            description=payload.description,
            source_node_types=payload.source_node_types,
            target_node_types=payload.target_node_types,
            multiplicity=payload.multiplicity,
            property_mappings=[m.model_dump() for m in payload.property_mappings],
        )
    except ValueError as exc:
        raise _conflict(exc) from exc
    await session.commit()
    return EdgeTypeResponse.model_validate(edge_type)


@models_router.patch(
    "/{model_id}/versions/{version_id}/edge-types/{type_id}",
    response_model=EdgeTypeResponse,
)
async def update_edge_type(
    payload: EdgeTypeUpdate,
    model_id: str = Path(...),
    version_id: str = Path(...),
    type_id: str = Path(...),
    _: GraphMember = Depends(require_graph_builder),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> EdgeTypeResponse:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    try:
        edge_type = await _store.update_edge_type(session, type_id, **payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise _conflict(exc) from exc
    if edge_type is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail={"error": "edge_type_not_found", "id": type_id})
    await session.commit()
    return EdgeTypeResponse.model_validate(edge_type)


@models_router.delete(
    "/{model_id}/versions/{version_id}/edge-types/{type_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_edge_type(
    model_id: str = Path(...),
    version_id: str = Path(...),
    type_id: str = Path(...),
    _: GraphMember = Depends(require_graph_builder),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    try:
        await _store.delete_edge_type(session, type_id)
    except ValueError as exc:
        raise _conflict(exc) from exc
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@models_router.post(
    "/{model_id}/versions/{version_id}/property-keys",
    response_model=PropertyKeyResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_property_key(
    payload: PropertyKeyCreate,
    model_id: str = Path(...),
    version_id: str = Path(...),
    _: GraphMember = Depends(require_graph_builder),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> PropertyKeyResponse:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    try:
        pk = await _store.create_property_key(
            session,
            version_id=version_id,
            name=payload.name,
            type=payload.type,
            value_cardinality=payload.value_cardinality,
            description=payload.description,
            validation_rules=[r.model_dump() for r in payload.validation_rules],
        )
    except ValueError as exc:
        raise _conflict(exc) from exc
    await session.commit()
    return PropertyKeyResponse.model_validate(pk)


@models_router.delete(
    "/{model_id}/versions/{version_id}/property-keys/{key_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_property_key(
    model_id: str = Path(...),
    version_id: str = Path(...),
    key_id: str = Path(...),
    _: GraphMember = Depends(require_graph_builder),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    try:
        await _store.delete_property_key(session, key_id)
    except ValueError as exc:
        raise _conflict(exc) from exc
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@models_router.post(
    "/{model_id}/versions/{version_id}/constraints",
    response_model=ConstraintResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_constraint(
    payload: ConstraintCreate,
    model_id: str = Path(...),
    version_id: str = Path(...),
    _: GraphMember = Depends(require_graph_builder),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ConstraintResponse:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    try:
        constraint = await _store.create_constraint(
            session,
            version_id=version_id,
            name=payload.name,
            target_kind=payload.target_kind,
            target_label=payload.target_label,
            constraint_type=payload.constraint_type,
            properties=payload.properties,
        )
    except ValueError as exc:
        raise _conflict(exc) from exc
    await session.commit()
    return ConstraintResponse.model_validate(constraint)


@models_router.delete(
    "/{model_id}/versions/{version_id}/constraints/{constraint_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_constraint(
    model_id: str = Path(...),
    version_id: str = Path(...),
    constraint_id: str = Path(...),
    _: GraphMember = Depends(require_graph_builder),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    try:
        await _store.delete_constraint(session, constraint_id)
    except ValueError as exc:
        raise _conflict(exc) from exc
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@models_router.post(
    "/{model_id}/versions/{version_id}/indexes",
    response_model=IndexResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_index(
    payload: IndexCreate,
    model_id: str = Path(...),
    version_id: str = Path(...),
    _: GraphMember = Depends(require_graph_builder),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> IndexResponse:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    try:
        index = await _store.create_index(
            session,
            version_id=version_id,
            name=payload.name,
            target_kind=payload.target_kind,
            target_label=payload.target_label,
            properties=payload.properties,
            index_type=payload.index_type,
            index_options=payload.index_options,
        )
    except ValueError as exc:
        raise _conflict(exc) from exc
    await session.commit()
    return IndexResponse.model_validate(index)


@models_router.delete(
    "/{model_id}/versions/{version_id}/indexes/{index_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_index(
    model_id: str = Path(...),
    version_id: str = Path(...),
    index_id: str = Path(...),
    _: GraphMember = Depends(require_graph_builder),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    try:
        await _store.delete_index(session, index_id)
    except ValueError as exc:
        raise _conflict(exc) from exc
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
