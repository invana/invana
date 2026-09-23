"""HTTP views for the Graph entity and its one connection.

Parse, call one manager, serialise (migration-plan §4.1). Setup progress comes
from ``apps.setup`` — deriving it is a cross-app read (§14.1).
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, Path, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.compatibility import (
    effective_read_only,
    load_profile,
    resolve_capabilities,
)
from invana.apps.graphs.managers import GraphManager
from invana.apps.graphs.models import Graph, GraphConnection, GraphMember, GraphStatus
from invana.apps.graphs.pool import GraphConnectionManager, GraphUnavailableError
from invana.apps.graphs.querysets import GraphConnectionQuerySet
from invana.apps.graphs.schemas import (
    ContentionRead,
    GraphConnectionCreate,
    GraphConnectionRead,
    GraphCreate,
    GraphListResponse,
    GraphRead,
    GraphUpdate,
    SetupSectionUpdate,
    VersionDeclareRequest,
)
from invana.apps.setup.managers import SetupManager
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.events import actions as event_actions
from invana.core.events.services import current_trace_id, emit_event
from invana.core.settings import settings
from invana.graph.types.capabilities import CompatibilityStatus, Version
from invana.graph.types.constants import Capability
from invana.runtime.querysets import TaskRunQuerySet
from invana.server.graphs.deps import (
    require_graph_member,
    resolve_graph_by_username_slug,
)
from invana.server.schemas import ActionResponse, action


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


async def create_graph(
    payload: GraphCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GraphRead:
    graph = await GraphManager().create_graph(session, owner=user, payload=payload)
    out = await SetupManager(TaskRunQuerySet()).graph_read(session, graph)
    await session.commit()
    return out


async def list_graphs(
    include_archived: bool = Query(
        default=False,
        description="Include archived graphs. Default hides them from the list.",
    ),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GraphListResponse:
    rows = await GraphManager().list_graphs_for_user(session, user_id=user.id, include_archived=include_archived)
    items = await SetupManager(TaskRunQuerySet()).graph_reads(session, rows)
    return GraphListResponse(items=items, total=len(items))


# ── Per-graph ────────────────────────────────────────────────────────────────


async def get_graph(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> GraphRead:
    return await SetupManager(TaskRunQuerySet()).graph_read(session, graph)


async def patch_graph(
    payload: GraphUpdate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[GraphRead]:
    await GraphManager().update_graph(session, graph=graph, payload=payload, actor_id=user.id)
    out = await SetupManager(TaskRunQuerySet()).graph_read(session, graph)
    await session.commit()
    # Backend owns the toast copy. Archiving toggles status on its own,
    # so distinguish it from a details save for a message that matches the intent.
    if "status" in payload.model_fields_set and payload.status is not None:
        message = "Graph archived" if payload.status == GraphStatus.archived else "Graph unarchived"
    else:
        message = "Graph settings saved"
    return action(message, out)


async def delete_graph(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await GraphManager().delete_graph(session, graph=graph, actor_id=user.id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Connection sub-resource — /u/{username}/{graphSlug}/connection
# ---------------------------------------------------------------------------


async def get_connection(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> GraphConnectionRead | None:
    connection = await GraphManager().get_graph_connection(session, graph_id=graph.id)
    return _build_connection_read(connection) if connection else None


async def put_connection(
    payload: GraphConnectionCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> GraphConnectionRead:
    connection, created = await GraphManager().put_graph_connection(
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


async def delete_connection(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> Response:
    connection = await GraphManager().delete_graph_connection(session, graph=graph, actor_id=user.id)
    await session.commit()
    if connection is not None:
        await manager.deregister(connection.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def acknowledge_connection_version(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GraphConnectionRead:
    """Accept the risk of an UNTESTED backend version — lifts the version read-only
    (docs/for-developers/modules/graph-connectors/features/capabilities.md)."""
    connection = await GraphManager().get_graph_connection(session, graph_id=graph.id)
    if connection is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No connection is attached to this Graph.")
    connections_qs = GraphConnectionQuerySet()
    connection = await connections_qs.acknowledge_version(session, connection.id)
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


async def declare_connection_version(
    payload: VersionDeclareRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GraphConnectionRead:
    """Declare a server version when auto-detection is unavailable (e.g. Gremlin)
    (docs/for-developers/modules/graph-connectors/features/capabilities.md)."""
    connection = await GraphManager().get_graph_connection(session, graph_id=graph.id)
    if connection is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No connection is attached to this Graph.")
    profile = load_profile(connection.connector_class)
    version = Version.parse(payload.server_version)
    new_status = profile.compatibility(version) if profile else CompatibilityStatus.UNKNOWN
    connections_qs = GraphConnectionQuerySet()
    await connections_qs.set_version(
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
    connection = await connections_qs.get(session, connection.id)
    return _build_connection_read(connection)


async def update_setup_section(
    payload: SetupSectionUpdate,
    section: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GraphRead:
    out = await SetupManager(TaskRunQuerySet()).update_setup_section(
        session, graph=graph, section=section, action=payload.action, actor_id=user.id
    )
    await session.commit()
    return out


async def test_connection(
    payload: GraphConnectionCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Validate connection credentials without persisting them.

    Build a transient connector with the provided settings, try to connect,
    discard. Used by the studio's "Test Connection" button to gate the
    save action.
    """
    result = await GraphManager().test_connection_credentials(
        uri=payload.uri,
        connector_class=payload.connector_class,
        auth=payload.auth,
        database=payload.database,
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
            "database": payload.database,
            **result,
        },
        trace_id=current_trace_id(),
    )
    await session.commit()
    return result


async def ping_connection(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> dict:
    connection = await GraphManager().get_graph_connection(session, graph_id=graph.id)
    if connection is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No connection is attached to this Graph.")
    await manager.reconnect(connection)
    return {"detail": "ping initiated"}


async def introspect_connection(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> dict:
    """Re-run schema introspection against the live graph DB (async)."""
    connection = await GraphManager().get_graph_connection(session, graph_id=graph.id)
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


async def get_contention(
    request: Request,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
) -> ContentionRead:
    """The Graph's ceiling, and what it is holding back right now.

    Read from the runtime rather than from a table: the queue lives in the
    process that owns the runs, and a row would be a second, staler answer to the
    same question.
    """
    runtime = getattr(request.app.state, "task_runtime", None)
    snapshot = (
        runtime.contention(graph.id, graph.pools or {})
        if runtime is not None
        else {"running": [], "queued": [], "pools": []}
    )
    return ContentionRead(
        ceiling=graph.max_concurrent_runs,
        policy=graph.concurrency_policy,
        running=snapshot["running"],
        queued=snapshot["queued"],
        running_count=len(snapshot["running"]),
        queued_count=len(snapshot["queued"]),
        # Configured on the Graph, in use in the process — so a pool nobody has
        # touched still lists, with `in_use: 0`. A pool that appeared only once
        # it was busy would make *is this Graph stalled on connections?* a
        # question nobody could answer in the quiet case (CC8).
        pools=snapshot.get("pools", []),
    )
