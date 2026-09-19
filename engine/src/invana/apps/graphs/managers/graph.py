"""Graph rules — the container a person creates, and its one connection.

Setup lives in `apps/setup`: deciding whether a Graph is ready is a cross-app
read, and keeping it here made four packages import `graphs` back
(migration-plan §14.1).
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import (
    Graph,
    GraphConnection,
    GraphMember,
)
from invana.apps.graphs.querysets import GraphConnectionQuerySet, GraphMemberQuerySet, GraphQuerySet
from invana.apps.graphs.schemas import (
    GraphCreate,
    GraphRead,
    GraphUpdate,
)
from invana.apps.setup.sections import _mark_section
from invana.core.auth.models import User
from invana.core.errors import ConflictError
from invana.core.events import actions
from invana.core.events.services import current_trace_id, diff_changed_fields, emit_event


class GraphManager:
    """Graph reads carry ``setup_state``, but **deriving** it is a cross-app read
    and lives in `apps/setup`. Callers that need the derived form pass it in;
    `graphs` never imports `setup`, which is what keeps §14.1's four cycles shut.
    """

    querysets = GraphQuerySet()
    connections = GraphConnectionQuerySet()
    members = GraphMemberQuerySet()

    async def create_graph(self, session: AsyncSession, *, owner: User, payload: GraphCreate) -> Graph:
        """Create a Graph and attach the creator as its member (binary access,
        docs/for-developers/modules/identity-and-access/features/membership.md).

        Returns the row. Serialising it is `SetupManager.graph_read`, because a
        Graph read carries **derived** setup state and deriving it is a cross-app
        read this package cannot make.
        """
        slug = payload.slug.lower()
        existing_graph = await self.querysets.get_by_slug(session, owner_id=owner.id, slug=slug)
        if existing_graph is not None:
            raise ConflictError(f"You already have a graph with slug '{slug}'.")

        graph = Graph(
            slug=slug,
            name=payload.name,
            instructions=payload.instructions,
            created_by_id=owner.id,
            setup_state={},
        )
        session.add(graph)
        await session.flush()

        session.add(GraphMember(graph_id=graph.id, user_id=owner.id))
        await session.flush()

        # Every graph is born with its agents — Explorer (the default), Query and
        # Modeller (docs/for-developers/modules/agents/spec.md). A session that names none still has one, so the
        # header can always say which mind is answering.
        from invana.apps.agents.managers import AgentManager  # noqa: PLC0415

        await AgentManager().seed_agents(session, graph=graph)
        await session.flush()

        await emit_event(
            session,
            action=actions.GRAPH_CREATE,
            target_kind=actions.TARGET_GRAPH,
            target_id=graph.id,
            graph_id=graph.id,
            actor_id=owner.id,
            details={"slug": graph.slug, "name": graph.name},
            trace_id=current_trace_id(),
        )
        # Implicit member.add of the owner — surfaces as a parallel event so the
        # graph's audit trail shows who joined and when.
        await emit_event(
            session,
            action=actions.MEMBER_ADD,
            target_kind=actions.TARGET_MEMBER,
            target_id=owner.id,
            graph_id=graph.id,
            actor_id=owner.id,
            details={"via": "graph.create"},
            trace_id=current_trace_id(),
        )

        return graph

    async def list_graphs_for_user(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        include_archived: bool = False,
    ) -> list[Graph]:
        """Return Graphs the user is a member of, most recently updated first.

        Archived graphs are hidden by default — they drop out of the main list into
        the Studio's "Archived" filter (which passes ``include_archived=True``).
        Archiving never blocks access: an archived graph is still reachable by URL
        and still queryable.
        """
        return await self.querysets.member_of(session, user_id=user_id, include_archived=include_archived)

    async def update_graph(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        payload: GraphUpdate,
        actor_id: str,
    ) -> Graph:
        data = payload.model_dump(exclude_unset=True)
        before = {f: getattr(graph, f) for f in data}
        for field, value in data.items():
            setattr(graph, field, value)
        instructions_completed = False
        if "instructions" in data and graph.instructions and graph.instructions.strip():
            already_complete = bool((graph.setup_state or {}).get("instructions", {}).get("completed_at"))
            _mark_section(graph, "instructions", "complete")
            instructions_completed = not already_complete
        await session.flush()
        after = {f: getattr(graph, f) for f in data}
        changed = diff_changed_fields(before, after, fields=list(data))
        if changed:
            await emit_event(
                session,
                action=actions.GRAPH_UPDATE,
                target_kind=actions.TARGET_GRAPH,
                target_id=graph.id,
                graph_id=graph.id,
                actor_id=actor_id,
                details={"changed": changed, "name": graph.name},
                trace_id=current_trace_id(),
            )
        if instructions_completed:
            await emit_event(
                session,
                action=actions.SETUP_COMPLETE,
                target_kind=actions.TARGET_GRAPH,
                target_id=graph.id,
                graph_id=graph.id,
                actor_id=actor_id,
                details={"section": "instructions", "via": "graph.update"},
                trace_id=current_trace_id(),
            )
        return graph

    async def delete_graph(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        actor_id: str,
    ) -> None:
        # Emit the event BEFORE deleting so the FK to graphs.id still resolves at
        # insert. The cascade (events.graph_id ON DELETE SET NULL) flips graph_id
        # to NULL on commit — fine, the per-graph view is unreachable for a
        # deleted graph anyway. `details.slug` + `details.name` carry the human
        # context the row lost when the FK went null.
        await emit_event(
            session,
            action=actions.GRAPH_DELETE,
            target_kind=actions.TARGET_GRAPH,
            target_id=graph.id,
            graph_id=graph.id,
            actor_id=actor_id,
            details={"slug": graph.slug, "name": graph.name},
            trace_id=current_trace_id(),
        )
        await session.delete(graph)
        await session.flush()

    async def get_graph_connection(self, session: AsyncSession, *, graph_id: str) -> GraphConnection | None:
        return await self.connections.for_graph(session, graph_id)

    async def put_graph_connection(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        payload,  # GraphConnectionCreate
        encryption_key: str,
        actor_id: str,
    ) -> tuple[GraphConnection, bool]:
        """Create or replace the Graph's connection. Returns (connection, created)."""
        from invana.apps.graphs.encryption import encrypt_credentials  # noqa: PLC0415

        existing = await self.get_graph_connection(session, graph_id=graph.id)
        if existing is None:
            connection = await self.connections.create(session, data=payload, encryption_key=encryption_key)
            connection.graph_id = graph.id
            # Saving connection details completes the graph_info wizard section
            # (re-applies on every save so a prior reset is undone).
            _mark_section(graph, "graph_info", "complete")
            await session.flush()
            await emit_event(
                session,
                action=actions.CONNECTION_ATTACH,
                target_kind=actions.TARGET_CONNECTION,
                target_id=connection.id,
                graph_id=graph.id,
                actor_id=actor_id,
                details={
                    "uri": connection.uri,
                    "connector_class": connection.connector_class,
                    "database": connection.database,
                    "read_only": connection.read_only,
                },
                trace_id=current_trace_id(),
            )
            return connection, True

        # Replace: update all fields. connector_class is immutable once set.
        if payload.connector_class != existing.connector_class:
            raise ConflictError("connector_class cannot be changed once a connection is established.")
        before = {
            "uri": existing.uri,
            "database": existing.database,
            "read_only": existing.read_only,
            "has_auth": existing.auth_encrypted is not None,
        }
        existing.uri = payload.uri
        # Blank means "the connector's default" (CD8) — unlike credentials, an empty
        # database field clears the stored name rather than keeping it.
        existing.database = (payload.database or "").strip() or None
        existing.read_only = payload.read_only
        if payload.auth:
            existing.auth_encrypted = encrypt_credentials(payload.auth, encryption_key)
        # Manually-declared version — the fallback for backends we cannot
        # auto-detect (modules/graph-connectors/features/capabilities.md).
        # A successful auto-detect on the reconnect below overrides it.
        declared = (payload.server_version or "").strip() or None
        if declared:
            from invana.apps.graphs.compatibility import compatibility_status_for  # noqa: PLC0415

            existing.server_version = declared
            existing.server_version_source = "declared"
            existing.compatibility_status = compatibility_status_for(existing.connector_class, declared)
            existing.version_acknowledged = False
        existing.status = "CONNECTING"
        _mark_section(graph, "graph_info", "complete")
        await session.flush()
        after = {
            "uri": existing.uri,
            "database": existing.database,
            "read_only": existing.read_only,
            "has_auth": existing.auth_encrypted is not None,
        }
        changed = diff_changed_fields(
            before,
            after,
            fields=["uri", "database", "read_only", "has_auth"],
        )
        if changed:
            await emit_event(
                session,
                action=actions.CONNECTION_UPDATE,
                target_kind=actions.TARGET_CONNECTION,
                target_id=existing.id,
                graph_id=graph.id,
                actor_id=actor_id,
                details={"changed": changed, "uri": existing.uri},
                trace_id=current_trace_id(),
            )
        return existing, False

    async def delete_graph_connection(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        actor_id: str,
    ) -> GraphConnection | None:
        """Hard-delete the Graph's connection. Returns the removed row for manager cleanup."""
        connection = await self.get_graph_connection(session, graph_id=graph.id)
        if connection is None:
            return None
        snapshot = {
            "uri": connection.uri,
            "connector_class": connection.connector_class,
            "database": connection.database,
        }
        conn_id = connection.id
        await session.delete(connection)
        # Removing the connection un-completes the graph_info wizard section.
        _mark_section(graph, "graph_info", "reset")
        await emit_event(
            session,
            action=actions.CONNECTION_DELETE,
            target_kind=actions.TARGET_CONNECTION,
            target_id=conn_id,
            graph_id=graph.id,
            actor_id=actor_id,
            details=snapshot,
            trace_id=current_trace_id(),
        )
        return connection

    async def serialize(self, session: AsyncSession, graph: Graph, *, setup_state: dict) -> GraphRead:
        """Hydrate a Graph row into the GraphRead payload (owner_username, member_count, has_connection).

        ``setup_state`` is **required** and is the derived state
        (`SetupManager.derive_setup_state`), never `graph.setup_state`. The stored
        column holds only skips and the instructions stamp, so serialising it
        leaves every derived section absent — which Studio reads as not done, and
        a graph with a pinged provider keeps being asked for one.
        """
        owner = await session.get(User, graph.created_by_id)
        member_count = await self.querysets.member_count(session, graph_id=graph.id)
        has_connection = await self.connections.count_for_graph(session, graph.id) > 0

        return GraphRead(
            id=graph.id,
            slug=graph.slug,
            name=graph.name,
            description=graph.description,
            instructions=graph.instructions,
            setup_state=setup_state,
            status=graph.status,
            owner_id=graph.created_by_id,
            owner_username=owner.username if owner else "",
            member_count=member_count,
            has_connection=has_connection,
            max_concurrent_runs=graph.max_concurrent_runs,
            concurrency_policy=graph.concurrency_policy,
            created_at=graph.created_at,
            updated_at=graph.updated_at,
        )


async def test_connection_credentials(
    *,
    uri: str,
    connector_class: str,
    auth: dict,
    database: str | None = None,
    timeout_s: float = 10.0,
) -> dict:
    """Build a transient connector and try to connect. Returns {ok, latency_ms?, error?}.

    The connector is never registered with the manager — it's discarded after
    the test. Used by the studio's "Test Connection" button to validate
    credentials before saving them.
    """
    import asyncio  # noqa: PLC0415
    import contextlib  # noqa: PLC0415
    import time  # noqa: PLC0415

    from invana.core.utils import import_class_from_dotted_path  # noqa: PLC0415

    try:
        ConnectorClass = import_class_from_dotted_path(connector_class)
    except Exception as exc:
        return {"ok": False, "error": f"Unknown connector '{connector_class}': {exc}"}

    # Only pass the database through when one is named — a blank field means the
    # connector's own default, and connectors that don't address databases at all
    # (Gremlin) would otherwise be handed a keyword they ignore.
    kwargs = dict(auth)
    if (database or "").strip():
        kwargs["database"] = database.strip()
    try:
        connector = ConnectorClass(uri=uri, **kwargs)
    except Exception as exc:
        return {"ok": False, "error": f"Could not build connector: {exc}"}

    t0 = time.monotonic()
    try:
        await asyncio.wait_for(connector.connect(), timeout=timeout_s)
        latency_ms = int((time.monotonic() - t0) * 1000)
        # connect() already auto-detected the server version
        # (docs/for-developers/modules/graph-connectors/features/capabilities.md). Capture it
        # here so the version is sourced from the database itself, not user input.
        resolved = connector.resolve_capabilities()
    except TimeoutError:
        return {"ok": False, "error": f"Connect timed out after {timeout_s:.0f}s."}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    finally:
        with contextlib.suppress(Exception):
            await connector.disconnect()

    return {
        "ok": True,
        "latency_ms": latency_ms,
        "server_version": str(resolved.version) if resolved.version else None,
        "compatibility_status": resolved.status.value,
    }
