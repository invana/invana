"""HTTP routes for the Graph container + graph-scoped sub-resources (RFC-017).

Two routers live here:

- ``graphs_collection_router`` at ``/api/v1/graphs`` — POST (create) + GET (list
  graphs the current user is a member of). The current user is the implicit
  owner on POST.
- ``graph_router`` at ``/api/v1/u/{username}/{graphSlug}`` — GET / PATCH / DELETE on
  the Graph itself, plus members + invitations. Future S2+ resources
  (connection, llm, skills, datasets) hang off the same prefix.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.auth.deps import get_current_user
from invana.auth.models import User
from invana.auth.schemas import (
    GraphMemberOut,
    GraphMemberRoleUpdate,
    InvitationCreateRequest,
    InvitationCreateResponse,
    InvitationOut,
)
from invana.db import get_session
from invana.events import actions as event_actions
from invana.events.services import current_trace_id, emit_event
from invana.graph.types.capabilities import CompatibilityStatus, Version
from invana.graph.types.constants import Capability
from invana.graphs import services
from invana.graphs.compatibility import (
    effective_read_only,
    load_profile,
    resolve_capabilities,
)
from invana.graphs.deps import (
    require_graph_admin,
    require_graph_member,
    resolve_graph_by_username_slug,
)
from invana.graphs.manager import GraphConnectionManager, GraphUnavailableError
from invana.graphs.models import Graph, GraphConnection, GraphMember
from invana.graphs.schemas import (
    GraphConnectionCreate,
    GraphConnectionRead,
    GraphCreate,
    GraphListResponse,
    GraphRead,
    GraphUpdate,
    SetupSectionUpdate,
    VersionDeclareRequest,
)
from invana.graphs.store import GraphConnectionStore
from invana.settings import settings


def _get_manager(request: Request) -> GraphConnectionManager:
    return request.app.state.graph_connection_manager


# Capabilities that Studio's query-language selector understands. Kept in
# this fixed order so the UI gets a stable default-language choice (first
# entry wins) regardless of set iteration order on the connector side.
_LANGUAGE_CAPABILITIES: tuple[Capability, ...] = (Capability.CYPHER, Capability.GREMLIN)


def _build_connection_read(connection: GraphConnection) -> GraphConnectionRead:
    """Project a GraphConnection ORM row into the wire schema with capabilities.

    Capabilities + supported property types are resolved server-side from the
    connector class's profile and the connection's detected/declared version.
    """
    payload = GraphConnectionRead.model_validate(connection)
    resolved, profile = resolve_capabilities(connection)
    caps = resolved.capabilities
    payload.capabilities = sorted(cap.value for cap in caps)
    payload.query_languages = [cap.value for cap in _LANGUAGE_CAPABILITIES if cap in caps]
    payload.supported_property_types = sorted(pt.value for pt in resolved.property_types)
    payload.compatibility_status = resolved.status.value
    payload.tested_version_range = profile.tested_range if profile else None
    payload.effective_read_only = effective_read_only(connection, status=resolved.status.value)
    return payload


# ---------------------------------------------------------------------------
# Collection — /api/v1/graphs
# ---------------------------------------------------------------------------

graphs_collection_router = APIRouter(prefix="/api/v1/graphs", tags=["graphs"])


@graphs_collection_router.post("", response_model=GraphRead, status_code=status.HTTP_201_CREATED)
async def create_graph(
    payload: GraphCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GraphRead:
    out = await services.create_graph(session, owner=user, payload=payload)
    await session.commit()
    return out


@graphs_collection_router.get("", response_model=GraphListResponse)
async def list_graphs(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GraphListResponse:
    items = await services.list_graphs_for_user(session, user_id=user.id)
    return GraphListResponse(items=items, total=len(items))


# ---------------------------------------------------------------------------
# Per-graph — /api/v1/u/{username}/{graphSlug}
# ---------------------------------------------------------------------------

graph_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}", tags=["graphs"])


@graph_router.get("", response_model=GraphRead)
async def get_graph(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> GraphRead:
    return await services.get_graph_detail(session, graph=graph)


@graph_router.patch("", response_model=GraphRead)
async def patch_graph(
    payload: GraphUpdate,
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GraphRead:
    out = await services.update_graph(session, graph=graph, payload=payload, actor_id=user.id)
    await session.commit()
    return out


@graph_router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_graph(
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await services.delete_graph(session, graph=graph, actor_id=user.id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------


@graph_router.get("/members", response_model=list[GraphMemberOut])
async def list_members(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> list[GraphMemberOut]:
    return await services.list_graph_members(session, graph_id=graph.id)


@graph_router.patch("/members/{user_id}", response_model=GraphMemberOut)
async def update_member_role(
    payload: GraphMemberRoleUpdate,
    user_id: str = Path(...),
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    actor: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GraphMemberOut:
    out = await services.update_graph_member_role(
        session,
        graph_id=graph.id,
        target_user_id=user_id,
        payload=payload,
        actor_id=actor.id,
    )
    await session.commit()
    return out


@graph_router.delete("/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    user_id: str = Path(...),
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    actor: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await services.remove_graph_member(session, graph_id=graph.id, target_user_id=user_id, actor_id=actor.id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Invitations
# ---------------------------------------------------------------------------


@graph_router.post("/invitations", response_model=InvitationCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    payload: InvitationCreateRequest,
    _: GraphMember = Depends(require_graph_admin),
    user: User = Depends(get_current_user),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> InvitationCreateResponse:
    out = await services.create_invitation(
        session,
        invited_by=user,
        graph_id=graph.id,
        payload=payload,
    )
    await session.commit()
    return out


@graph_router.get("/invitations", response_model=list[InvitationOut])
async def list_invitations(
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> list[InvitationOut]:
    return await services.list_graph_invitations(session, graph_id=graph.id)


@graph_router.delete("/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invitation(
    invitation_id: str = Path(...),
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    actor: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await services.delete_invitation(
        session,
        graph_id=graph.id,
        invitation_id=invitation_id,
        actor_id=actor.id,
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Connection sub-resource — /u/{username}/{graphSlug}/connection
# ---------------------------------------------------------------------------


@graph_router.get("/connection", response_model=GraphConnectionRead | None)
async def get_connection(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> GraphConnectionRead | None:
    connection = await services.get_graph_connection(session, graph_id=graph.id)
    return _build_connection_read(connection) if connection else None


@graph_router.put("/connection", response_model=GraphConnectionRead)
async def put_connection(
    payload: GraphConnectionCreate,
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> GraphConnectionRead:
    connection, created = await services.put_graph_connection(
        session,
        graph=graph,
        payload=payload,
        encryption_key=settings.encryption_key,
        actor_id=user.id,
    )
    await session.commit()
    await session.refresh(connection)

    if created:
        await manager.register(connection)
    else:
        await manager.reconnect(connection)

    return _build_connection_read(connection)


@graph_router.delete("/connection", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> Response:
    connection = await services.delete_graph_connection(session, graph=graph, actor_id=user.id)
    await session.commit()
    if connection is not None:
        await manager.deregister(connection.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@graph_router.post("/connection/acknowledge-version", response_model=GraphConnectionRead)
async def acknowledge_connection_version(
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GraphConnectionRead:
    """Accept the risk of an UNTESTED backend version — lifts the version read-only (RFC-022)."""
    connection = await services.get_graph_connection(session, graph_id=graph.id)
    if connection is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No connection is attached to this Graph.")
    store = GraphConnectionStore()
    connection = await store.acknowledge_version(session, connection.id)
    await emit_event(
        session,
        action=event_actions.CONNECTION_VERSION_ACKNOWLEDGE,
        target_kind=event_actions.TARGET_CONNECTION,
        target_id=connection.id,
        graph_id=graph.id,
        actor_id=user.id,
        details={
            "server_version": connection.server_version,
            "compatibility_status": connection.compatibility_status,
        },
        trace_id=current_trace_id(),
    )
    await session.commit()
    await session.refresh(connection)
    return _build_connection_read(connection)


@graph_router.patch("/connection/version", response_model=GraphConnectionRead)
async def declare_connection_version(
    payload: VersionDeclareRequest,
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GraphConnectionRead:
    """Declare a server version when auto-detection is unavailable (e.g. Gremlin) (RFC-022)."""
    connection = await services.get_graph_connection(session, graph_id=graph.id)
    if connection is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No connection is attached to this Graph.")
    profile = load_profile(connection.connector_class)
    version = Version.parse(payload.server_version)
    new_status = profile.compatibility(version) if profile else CompatibilityStatus.UNKNOWN
    store = GraphConnectionStore()
    await store.set_version(
        session,
        connection.id,
        server_version=payload.server_version,
        source="declared",
        compatibility_status=new_status.value,
    )
    await emit_event(
        session,
        action=event_actions.CONNECTION_VERSION_DECLARE,
        target_kind=event_actions.TARGET_CONNECTION,
        target_id=connection.id,
        graph_id=graph.id,
        actor_id=user.id,
        details={"server_version": payload.server_version, "compatibility_status": new_status.value},
        trace_id=current_trace_id(),
    )
    await session.commit()
    connection = await store.get(session, connection.id)
    return _build_connection_read(connection)


@graph_router.post("/setup/{section}", response_model=GraphRead)
async def update_setup_section(
    payload: SetupSectionUpdate,
    section: str = Path(...),
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GraphRead:
    out = await services.update_setup_section(
        session, graph=graph, section=section, action=payload.action, actor_id=user.id
    )
    await session.commit()
    return out


@graph_router.post("/connection/test")
async def test_connection(
    payload: GraphConnectionCreate,
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Validate connection credentials without persisting them.

    Build a transient connector with the provided settings, try to connect,
    discard. Used by the studio's "Test Connection" button to gate the
    save action.
    """
    result = await services.test_connection_credentials(
        uri=payload.uri,
        connector_class=payload.connector_class,
        auth=payload.auth,
    )
    await emit_event(
        session,
        action=event_actions.CONNECTION_TEST,
        target_kind=event_actions.TARGET_CONNECTION,
        graph_id=graph.id,
        actor_id=user.id,
        details={
            "uri": payload.uri,
            "connector_class": payload.connector_class,
            **result,
        },
        trace_id=current_trace_id(),
    )
    await session.commit()
    return result


@graph_router.post("/connection/ping", status_code=status.HTTP_202_ACCEPTED)
async def ping_connection(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> dict:
    connection = await services.get_graph_connection(session, graph_id=graph.id)
    if connection is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No connection is attached to this Graph.")
    await manager.reconnect(connection)
    return {"detail": "ping initiated"}


@graph_router.post("/connection/introspect", status_code=status.HTTP_202_ACCEPTED)
async def introspect_connection(
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> dict:
    """Re-run schema introspection against the live graph DB (async)."""
    connection = await services.get_graph_connection(session, graph_id=graph.id)
    if connection is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No connection is attached to this Graph.")

    try:
        connector = manager.get_connector(connection.id)
    except GraphUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "graph_not_active", "connection_id": connection.id},
        ) from None

    # Fire-and-forget in a dedicated session — must NOT reuse `session`, which
    # the request closes on return (races the task → asyncpg "another operation
    # in progress"). Pass the id + in-memory connector instead.
    manager._spawn(manager.introspect(connection.id, connector))
    return {"detail": "introspection initiated"}


__all__ = ["graph_router", "graphs_collection_router"]
