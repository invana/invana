"""Graph-model endpoints — graph-scoped under /u/{username}/{graphSlug}/models.

A Graph owns many **graph models** (docs/for-developers/modules/connect-and-model/features/domain-models.md). Each model
has a
versioned type tree (node/edge types, property keys, constraints, indexes).
This router is thin plumbing over ``ModelStore`` (which already implements all
CRUD) + ``Versioner``.

Routes
------
GET    /                                   list the graph's models
POST   /                                   create a blank model (+ initial draft)
GET    /{model_id}                         model detail (+ versions)
PATCH  /{model_id}                         update name/description/validation_mode/status
DELETE /{model_id}                         hard delete (cascades versions)

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

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.compatibility import supported_property_type_values
from invana.apps.graphs.managers import GraphManager
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.modeller import starters as starter_models
from invana.apps.modeller.json_io import SchemaExporter
from invana.apps.modeller.models import GraphModel, GraphVersion
from invana.apps.modeller.portability import (
    ImportRefused,
    ModelArtefact,
    build_artefact,
    compute_content_hash,
    import_artefact,
    unsupported_property_types,
    upgrade_model,
)
from invana.apps.modeller.schemas import (
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
    PropertyKeyUpdate,
    SchemaDiff,
    VersionActivate,
    VersionCreate,
    VersionResponse,
    VersionSummary,
)
from invana.apps.modeller.staging import StagedSet, UnknownChange, collect, discard_all, discard_one
from invana.apps.modeller.store import ModelStore
from invana.apps.modeller.versioner import Versioner, compute_diff
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.events import actions as event_actions
from invana.core.events.services import emit_event
from invana.server.graphs.deps import (
    require_graph_member,
    resolve_graph_by_username_slug,
)
from invana.server.schemas import ActionResponse, action

models_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/models", tags=["models"])

_store = ModelStore()


# ---------------------------------------------------------------------------
# Request and response shapes owned by this router
#
# They live here rather than in ``modeller.schemas`` because they are the HTTP
# envelope around an artefact, not part of the model's own vocabulary.
# ---------------------------------------------------------------------------


class ModelImportRequest(BaseModel):
    """An artefact to land, either inline or by starter slug — never both."""

    artefact: ModelArtefact | None = None
    starter: str | None = None
    # The name is local (SM2). Given here, it is what the model is called on arrival.
    name: str | None = None


class ModelImportResult(BaseModel):
    model: GraphModelResponse
    version: VersionResponse
    # Types this database cannot hold. The draft still landed (SM4); it just
    # cannot publish until they are resolved.
    unsupported_property_types: list[dict[str, str]] = []
    publishable: bool = True


class ModelUpgradeResult(BaseModel):
    model: GraphModelResponse
    version: VersionResponse
    diff: SchemaDiff
    unsupported_property_types: list[dict[str, str]] = []
    publishable: bool = True


class CommitRequest(BaseModel):
    """Optional override of the semver the commit assigns."""

    version: str | None = None


class CommitResult(BaseModel):
    version: VersionResponse
    committed: int = 0
    content_hash: str | None = None


def _resolve_import_payload(payload: ModelImportRequest) -> tuple[ModelArtefact, str]:
    """One artefact, from exactly one place."""
    if (payload.artefact is None) == (payload.starter is None):
        raise HTTPException(
            HTTPStatus.UNPROCESSABLE_ENTITY,
            detail={"error": "import_source_ambiguous", "message": "Give either an artefact or a starter, not both."},
        )
    if payload.starter is not None:
        try:
            return starter_models.get(payload.starter), "starter"
        except KeyError as exc:
            raise HTTPException(
                HTTPStatus.NOT_FOUND,
                detail={"error": "starter_not_found", "starter": payload.starter, "available": starter_models.slugs()},
            ) from exc
    return payload.artefact, "file"


async def _unsupported_for_graph(session: AsyncSession, graph: Graph, artefact: ModelArtefact) -> list[dict[str, str]]:
    """Property types the bound database cannot hold, named rather than dropped (SM4)."""
    connection = await GraphManager().get_graph_connection(session, graph_id=graph.id)
    if connection is None:
        return []
    return unsupported_property_types(artefact.model, supported_property_type_values(connection))


def _import_message(name: str, blockers: list[dict[str, str]]) -> str:
    if not blockers:
        return f'"{name}" imported as a draft — rename what you want, then publish.'
    listed = ", ".join(f"{b['property_key']} ({b['type']})" for b in blockers)
    return f'"{name}" imported as a draft, but it cannot publish here yet: this database cannot hold {listed}.'


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


async def _enforce_supported_type(session: AsyncSession, graph: Graph, type_str: str) -> None:
    """Reject a property type the bound backend can't store for its version
    (docs/for-developers/modules/graph-connectors/features/capabilities.md).

    No-ops when no connection is bound or the connector reports no profile (unknown
    backend) — the modeller falls back to its full vocabulary in those cases.
    """
    connection = await GraphManager().get_graph_connection(session, graph_id=graph.id)
    if connection is None:
        return
    supported = supported_property_type_values(connection)
    if not supported:
        return
    # Canonicalise parameterised types (e.g. ``list[string]`` → ``list``).
    base = type_str.split("[", 1)[0].strip().lower()
    if base in supported:
        return
    raise HTTPException(
        HTTPStatus.UNPROCESSABLE_ENTITY,
        detail={
            "error": "unsupported_property_type",
            "type": type_str,
            "connector_class": connection.connector_class,
            "server_version": connection.server_version,
            "supported": sorted(supported),
        },
    )


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


@models_router.post("", response_model=ActionResponse[GraphModelResponse], status_code=status.HTTP_201_CREATED)
async def create_model(
    payload: GraphModelCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[GraphModelResponse]:
    model = await _store.create_graph_model(
        session,
        name=payload.name,
        graph_id=graph.id,
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
        details={"name": model.name},
    )
    await session.commit()
    model = await _store.get_graph_model(session, model.id)
    return action(f'Model "{model.name}" created.', _to_response(model))


# ---------------------------------------------------------------------------
# Portability and starters (share-a-model.md · starter-models.md)
#
# Declared before ``/{model_id}``: a literal path has to be registered ahead of
# the parameterised one, or "starters" arrives as a model id.
# ---------------------------------------------------------------------------


@models_router.get("/starters", response_model=list[starter_models.StarterSummary])
async def list_starters(
    _: GraphMember = Depends(require_graph_member),
    __: Graph = Depends(resolve_graph_by_username_slug),
) -> list[starter_models.StarterSummary]:
    """The starters shipped with this distribution. Ordinary artefacts (SR1)."""
    return starter_models.summaries()


@models_router.post(
    "/import",
    response_model=ActionResponse[ModelImportResult],
    status_code=status.HTTP_201_CREATED,
)
async def import_model(
    payload: ModelImportRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[ModelImportResult]:
    """Land an artefact — a file's contents, or a starter by slug — as a draft."""
    artefact, import_source = _resolve_import_payload(payload)

    try:
        model, version_id = await import_artefact(
            session,
            _store,
            graph_id=graph.id,
            artefact=artefact,
            name=payload.name,
            import_source=import_source,
        )
    except ImportRefused as exc:
        raise HTTPException(HTTPStatus.CONFLICT, detail={"error": exc.error, **exc.detail}) from exc

    blockers = await _unsupported_for_graph(session, graph, artefact)
    await emit_event(
        session,
        action=event_actions.MODEL_IMPORT,
        target_kind=event_actions.TARGET_MODEL,
        target_id=model.id,
        graph_id=graph.id,
        actor_id=user.id,
        details={
            "name": model.name,
            "package_id": artefact.package_id,
            "content_hash": artefact.content_hash,
            "source": import_source,
            "unsupported": blockers,
        },
    )
    await session.commit()
    model = await _store.get_graph_model(session, model.id)
    return action(
        _import_message(model.name, blockers),
        ModelImportResult(
            model=_to_response(model),
            version=await _full_version(session, version_id),
            unsupported_property_types=blockers,
            publishable=not blockers,
        ),
    )


@models_router.get("/{model_id}", response_model=GraphModelResponse)
async def get_model(
    model_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> GraphModelResponse:
    model = await _get_model_or_404(session, graph.id, model_id)
    return _to_response(model)


@models_router.patch("/{model_id}", response_model=ActionResponse[GraphModelResponse])
async def update_model(
    payload: GraphModelUpdate,
    model_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[GraphModelResponse]:
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
    return action("Model updated.", _to_response(model))


@models_router.delete("/{model_id}", response_model=ActionResponse[None])
async def delete_model(
    model_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[None]:
    model = await _get_model_or_404(session, graph.id, model_id)
    name = model.name
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
    return action(f'Model "{name}" deleted.')


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


@models_router.post(
    "/{model_id}/versions",
    response_model=ActionResponse[VersionResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_draft_version(
    payload: VersionCreate,
    model_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[VersionResponse]:
    model = await _get_model_or_404(session, graph.id, model_id)
    if model.origin == "introspected":
        raise HTTPException(
            HTTPStatus.CONFLICT,
            detail={
                "error": "model_read_only",
                "message": (
                    "The global model is system-managed (regenerated by introspection) and cannot be hand-authored."
                ),
            },
        )
    try:
        version = await _store.create_version(session, model_id=model_id, based_on=payload.based_on)
    except ValueError as exc:
        raise _conflict(exc) from exc
    await session.commit()
    return action("Draft created — you can now edit this model.", await _full_version(session, version.id))


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


@models_router.post("/{model_id}/versions/{version_id}/activate", response_model=ActionResponse[VersionResponse])
async def activate_version(
    payload: VersionActivate,
    model_id: str = Path(...),
    version_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[VersionResponse]:
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
    return action("Model published.", await _full_version(session, activated.id))


# ---------------------------------------------------------------------------
# Type authoring (draft versions only)
# ---------------------------------------------------------------------------


@models_router.post(
    "/{model_id}/versions/{version_id}/node-types",
    response_model=ActionResponse[NodeTypeResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_node_type(
    payload: NodeTypeCreate,
    model_id: str = Path(...),
    version_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[NodeTypeResponse]:
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
    return action(f'Node type "{node_type.name}" created.', NodeTypeResponse.model_validate(node_type))


@models_router.patch(
    "/{model_id}/versions/{version_id}/node-types/{type_id}",
    response_model=ActionResponse[NodeTypeResponse],
)
async def update_node_type(
    payload: NodeTypeUpdate,
    model_id: str = Path(...),
    version_id: str = Path(...),
    type_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[NodeTypeResponse]:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    try:
        node_type = await _store.update_node_type(session, type_id, **payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise _conflict(exc) from exc
    if node_type is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail={"error": "node_type_not_found", "id": type_id})
    await session.commit()
    return action("Node type updated.", NodeTypeResponse.model_validate(node_type))


@models_router.delete(
    "/{model_id}/versions/{version_id}/node-types/{type_id}",
    response_model=ActionResponse[None],
)
async def delete_node_type(
    model_id: str = Path(...),
    version_id: str = Path(...),
    type_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[None]:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    try:
        await _store.delete_node_type(session, type_id)
    except ValueError as exc:
        raise _conflict(exc) from exc
    await session.commit()
    return action("Node type deleted.")


@models_router.post(
    "/{model_id}/versions/{version_id}/edge-types",
    response_model=ActionResponse[EdgeTypeResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_edge_type(
    payload: EdgeTypeCreate,
    model_id: str = Path(...),
    version_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[EdgeTypeResponse]:
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
    return action(f'Edge type "{edge_type.name}" created.', EdgeTypeResponse.model_validate(edge_type))


@models_router.patch(
    "/{model_id}/versions/{version_id}/edge-types/{type_id}",
    response_model=ActionResponse[EdgeTypeResponse],
)
async def update_edge_type(
    payload: EdgeTypeUpdate,
    model_id: str = Path(...),
    version_id: str = Path(...),
    type_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[EdgeTypeResponse]:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    try:
        edge_type = await _store.update_edge_type(session, type_id, **payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise _conflict(exc) from exc
    if edge_type is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail={"error": "edge_type_not_found", "id": type_id})
    await session.commit()
    return action("Edge type updated.", EdgeTypeResponse.model_validate(edge_type))


@models_router.delete(
    "/{model_id}/versions/{version_id}/edge-types/{type_id}",
    response_model=ActionResponse[None],
)
async def delete_edge_type(
    model_id: str = Path(...),
    version_id: str = Path(...),
    type_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[None]:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    try:
        await _store.delete_edge_type(session, type_id)
    except ValueError as exc:
        raise _conflict(exc) from exc
    await session.commit()
    return action("Edge type deleted.")


@models_router.post(
    "/{model_id}/versions/{version_id}/property-keys",
    response_model=ActionResponse[PropertyKeyResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_property_key(
    payload: PropertyKeyCreate,
    model_id: str = Path(...),
    version_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[PropertyKeyResponse]:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    await _enforce_supported_type(session, graph, payload.type)
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
    return action(f'Property key "{pk.name}" created.', PropertyKeyResponse.model_validate(pk))


@models_router.patch(
    "/{model_id}/versions/{version_id}/property-keys/{key_id}",
    response_model=ActionResponse[PropertyKeyResponse],
)
async def update_property_key(
    payload: PropertyKeyUpdate,
    model_id: str = Path(...),
    version_id: str = Path(...),
    key_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[PropertyKeyResponse]:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    fields = payload.model_dump(exclude_unset=True)
    if "type" in fields and fields["type"] is not None:
        await _enforce_supported_type(session, graph, fields["type"])
    try:
        pk = await _store.update_property_key(session, key_id, **fields)
    except ValueError as exc:
        raise _conflict(exc) from exc
    if pk is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail={"error": "property_key_not_found", "id": key_id})
    await session.commit()
    return action("Property key updated.", PropertyKeyResponse.model_validate(pk))


@models_router.delete(
    "/{model_id}/versions/{version_id}/property-keys/{key_id}",
    response_model=ActionResponse[None],
)
async def delete_property_key(
    model_id: str = Path(...),
    version_id: str = Path(...),
    key_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[None]:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    try:
        await _store.delete_property_key(session, key_id)
    except ValueError as exc:
        raise _conflict(exc) from exc
    await session.commit()
    return action("Property key deleted.")


@models_router.post(
    "/{model_id}/versions/{version_id}/constraints",
    response_model=ActionResponse[ConstraintResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_constraint(
    payload: ConstraintCreate,
    model_id: str = Path(...),
    version_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[ConstraintResponse]:
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
    return action(f'Constraint "{constraint.name}" created.', ConstraintResponse.model_validate(constraint))


@models_router.delete(
    "/{model_id}/versions/{version_id}/constraints/{constraint_id}",
    response_model=ActionResponse[None],
)
async def delete_constraint(
    model_id: str = Path(...),
    version_id: str = Path(...),
    constraint_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[None]:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    try:
        await _store.delete_constraint(session, constraint_id)
    except ValueError as exc:
        raise _conflict(exc) from exc
    await session.commit()
    return action("Constraint deleted.")


@models_router.post(
    "/{model_id}/versions/{version_id}/indexes",
    response_model=ActionResponse[IndexResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_index(
    payload: IndexCreate,
    model_id: str = Path(...),
    version_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[IndexResponse]:
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
    return action(f'Index "{index.name}" created.', IndexResponse.model_validate(index))


@models_router.delete(
    "/{model_id}/versions/{version_id}/indexes/{index_id}",
    response_model=ActionResponse[None],
)
async def delete_index(
    model_id: str = Path(...),
    version_id: str = Path(...),
    index_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[None]:
    await _get_draft_version_or_404(session, graph.id, model_id, version_id)
    try:
        await _store.delete_index(session, index_id)
    except ValueError as exc:
        raise _conflict(exc) from exc
    await session.commit()
    return action("Index deleted.")


# ---------------------------------------------------------------------------
# The staged set and the commit (model-editor.md)
#
# The draft *is* the staged set (ME2, ME4). Nothing is recorded on the side: what
# is staged is the difference between the draft and the version it replaces, so it
# survives a reload and reads the same to everyone who opens the model.
# ---------------------------------------------------------------------------


async def _draft_and_active(
    session: AsyncSession, graph_id: str, model_id: str
) -> tuple[GraphVersion, GraphVersion | None]:
    await _get_model_or_404(session, graph_id, model_id)
    versions = await _store.list_versions(session, model_id)
    draft_summary = next((v for v in versions if v.status == "draft"), None)
    if draft_summary is None:
        raise HTTPException(
            HTTPStatus.NOT_FOUND,
            detail={"error": "no_draft", "model_id": model_id, "message": "This model has no draft to stage onto."},
        )
    draft = await _store.get_version(session, draft_summary.id)
    active = await _store.get_active_version(session, model_id)
    return draft, active


@models_router.get("/{model_id}/draft/staged", response_model=StagedSet)
async def get_staged_set(
    model_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> StagedSet:
    draft, active = await _draft_and_active(session, graph.id, model_id)
    return collect(active, draft)


@models_router.post("/{model_id}/draft/discard", response_model=ActionResponse[StagedSet])
async def discard_staged_set(
    model_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[StagedSet]:
    """Put the draft back to the published version, wholesale."""
    draft, active = await _draft_and_active(session, graph.id, model_id)
    if active is None:
        raise HTTPException(
            HTTPStatus.CONFLICT,
            detail={
                "error": "nothing_to_discard_to",
                "message": "This model has never published, so there is no state to return the draft to.",
            },
        )
    discarded = collect(active, draft).count
    await discard_all(session, _store, active=active, draft=draft)
    await emit_event(
        session,
        action=event_actions.MODEL_DISCARD,
        target_kind=event_actions.TARGET_MODEL,
        target_id=model_id,
        graph_id=graph.id,
        actor_id=user.id,
        details={"discarded": discarded, "scope": "all"},
    )
    await session.commit()
    draft, active = await _draft_and_active(session, graph.id, model_id)
    return action(f"{discarded} staged changes discarded.", collect(active, draft))


@models_router.delete("/{model_id}/draft/staged/{change_id}", response_model=ActionResponse[StagedSet])
async def discard_staged_change(
    model_id: str = Path(...),
    change_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[StagedSet]:
    """Put one element back the way the published version has it."""
    draft, active = await _draft_and_active(session, graph.id, model_id)
    if active is None:
        raise HTTPException(
            HTTPStatus.CONFLICT,
            detail={
                "error": "nothing_to_discard_to",
                "message": "This model has never published, so there is no state to return the draft to.",
            },
        )
    try:
        change = await discard_one(session, _store, active=active, draft=draft, change_id=change_id)
    except UnknownChange as exc:
        raise HTTPException(
            HTTPStatus.NOT_FOUND,
            detail={"error": "unknown_staged_change", "change_id": change_id},
        ) from exc
    await emit_event(
        session,
        action=event_actions.MODEL_DISCARD,
        target_kind=event_actions.TARGET_MODEL,
        target_id=model_id,
        graph_id=graph.id,
        actor_id=user.id,
        details={"discarded": 1, "scope": "one", "change": change.id},
    )
    await session.commit()
    draft, active = await _draft_and_active(session, graph.id, model_id)
    return action(f"{change.kind.replace('_', ' ')} {change.name} discarded.", collect(active, draft))


@models_router.post("/{model_id}/commit", response_model=ActionResponse[CommitResult])
async def commit_draft(
    payload: CommitRequest,
    model_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[CommitResult]:
    """Turn the whole staged set into the next published version, in one action (ME5)."""
    model = await _get_model_or_404(session, graph.id, model_id)
    draft, active = await _draft_and_active(session, graph.id, model_id)
    staged = collect(active, draft)
    if not staged.can_commit:
        raise HTTPException(
            HTTPStatus.CONFLICT,
            detail={"error": "nothing_staged", "message": staged.reason},
        )

    try:
        published = await Versioner(_store).activate(session, version_id=draft.id, override_version=payload.version)
    except ValueError as exc:
        raise _conflict(exc) from exc

    published = await _store.get_version(session, published.id)
    export = SchemaExporter.export(
        published,
        schema_name=model.name,
        schema_description=model.description,
        validation_mode=model.validation_mode,
    )
    published.content_hash = compute_content_hash(export)

    await emit_event(
        session,
        action=event_actions.MODEL_COMMIT,
        target_kind=event_actions.TARGET_MODEL,
        target_id=model_id,
        graph_id=graph.id,
        actor_id=user.id,
        details={
            "version": published.version,
            "committed": staged.count,
            "content_hash": published.content_hash,
            "changes": [c.id for c in staged.changes],
        },
    )
    await session.commit()
    return action(
        f"{staged.count} changes committed — {model.name} {published.version} published.",
        CommitResult(
            version=await _full_version(session, published.id),
            committed=staged.count,
            content_hash=published.content_hash,
        ),
    )


# ---------------------------------------------------------------------------
# Export and upgrade (share-a-model.md)
# ---------------------------------------------------------------------------


@models_router.get("/{model_id}/export", response_model=ModelArtefact)
async def export_model(
    model_id: str = Path(...),
    version_id: str | None = None,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ModelArtefact:
    """One published version as one self-contained file (C1)."""
    model = await _get_model_or_404(session, graph.id, model_id)
    version = (
        await _store.get_version(session, version_id)
        if version_id
        else await _store.get_active_version(session, model_id)
    )
    if version is None or version.model_id != model_id:
        raise HTTPException(
            HTTPStatus.NOT_FOUND,
            detail={"error": "no_published_version", "model_id": model_id},
        )
    if version.status == "draft":
        raise HTTPException(
            HTTPStatus.CONFLICT,
            detail={
                "error": "version_is_draft",
                "message": "A draft has nothing stable to export — commit it first.",
            },
        )
    artefact = build_artefact(model, version)
    await emit_event(
        session,
        action=event_actions.MODEL_EXPORT,
        target_kind=event_actions.TARGET_MODEL,
        target_id=model_id,
        graph_id=graph.id,
        actor_id=user.id,
        details={"version": version.version, "package_id": artefact.package_id, "content_hash": artefact.content_hash},
    )
    await session.commit()
    return artefact


@models_router.post("/{model_id}/upgrade", response_model=ActionResponse[ModelUpgradeResult])
async def upgrade_model_route(
    payload: ModelImportRequest,
    model_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[ModelUpgradeResult]:
    """Bring a newer version of the same package in as a draft, with the diff (C3)."""
    model = await _get_model_or_404(session, graph.id, model_id)
    artefact, _source = _resolve_import_payload(payload)

    existing_draft = next((v for v in await _store.list_versions(session, model_id) if v.status == "draft"), None)
    if existing_draft is not None:
        raise HTTPException(
            HTTPStatus.CONFLICT,
            detail={
                "error": "draft_in_the_way",
                "version_id": existing_draft.id,
                "message": "This model already has a draft. Commit or discard it before upgrading — "
                "an upgrade never silently overwrites local work.",
            },
        )

    try:
        version_id = await upgrade_model(session, _store, model=model, artefact=artefact)
    except ImportRefused as exc:
        raise HTTPException(HTTPStatus.CONFLICT, detail={"error": exc.error, **exc.detail}) from exc

    blockers = await _unsupported_for_graph(session, graph, artefact)
    active = await _store.get_active_version(session, model_id)
    draft = await _store.get_version(session, version_id)
    diff = compute_diff(active, draft) if active is not None else SchemaDiff()

    await emit_event(
        session,
        action=event_actions.MODEL_UPGRADE,
        target_kind=event_actions.TARGET_MODEL,
        target_id=model_id,
        graph_id=graph.id,
        actor_id=user.id,
        details={
            "package_id": artefact.package_id,
            "content_hash": artefact.content_hash,
            "from_version": active.version if active else None,
            "classification": diff.classification,
        },
    )
    await session.commit()
    return action(
        f"{model.name} upgraded to a draft — review the diff, then commit.",
        ModelUpgradeResult(
            model=_to_response(await _store.get_graph_model(session, model_id)),
            version=await _full_version(session, version_id),
            diff=diff,
            unsupported_property_types=blockers,
            publishable=not blockers,
        ),
    )


@models_router.get("/{model_id}/versions/{version_id}/diff", response_model=SchemaDiff)
async def diff_version(
    model_id: str = Path(...),
    version_id: str = Path(...),
    against: str | None = None,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SchemaDiff:
    """What changed between two versions of this model.

    The version bar states this (domain-models.md · Surfaces): a list of numbers
    with no account of what moved between them is a list nobody can act on. With
    no `against`, it diffs against the version immediately before this one, which
    is the question being asked nine times in ten.
    """
    await _get_model_or_404(session, graph.id, model_id)
    versions = await _store.list_versions(session, model_id)
    ordered = [v for v in versions if v.status != "draft"]

    target = await _store.get_version(session, version_id)
    if target is None or target.model_id != model_id:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail={"error": "version_not_found", "version_id": version_id})

    if against:
        base = await _store.get_version(session, against)
        if base is None or base.model_id != model_id:
            raise HTTPException(HTTPStatus.NOT_FOUND, detail={"error": "version_not_found", "version_id": against})
    else:
        index = next((i for i, v in enumerate(ordered) if v.id == version_id), None)
        previous = ordered[index - 1] if index else None
        # The first published version changed everything — diffing it against
        # nothing is more honest than diffing it against itself.
        base = await _store.get_version(session, previous.id) if previous else None

    if base is None:
        return SchemaDiff(
            added_node_types=[nt.name for nt in target.node_types],
            added_edge_types=[et.name for et in target.edge_types],
            added_property_keys=[pk.name for pk in target.property_keys],
            classification="major",
        )
    return compute_diff(base, target)
