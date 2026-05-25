"""GraphConnectionManager — runtime connector pool for persisted Graph records.

Responsibilities
----------------
- Owns all live ``BaseConnector`` instances (one per active Graph).
- Maintains a health-check loop and auto-reconnects with exponential backoff.
- Auto-introspects the graph DB on first successful connect when no schema exists.
- Exposes four public methods for route handlers: ``get_connector``, ``register``,
  ``deregister``, ``reconnect``.

All internal state (``_registry``, ``_retry_tasks``) is private — routes must not
access these directly.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import TYPE_CHECKING

from invana.events import actions as event_actions
from invana.events.models import ActorType
from invana.events.services import emit_event
from invana.graphs.encryption import decrypt_credentials
from invana.graphs.models import Graph
from invana.graphs.store import GraphModelStore
from invana.modeller.introspector import Introspector
from invana.modeller.store import ModelStore
from invana.settings import settings
from invana.utils import import_class_from_dotted_path

if TYPE_CHECKING:
    from collections.abc import Coroutine
    from typing import Any

    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from invana.graph.connectors.base.connector import BaseConnector
    from invana.graphs.models import GraphConnection

logger = logging.getLogger(__name__)


class GraphUnavailableError(Exception):
    """Raised when a connector is requested for a graph that is not ACTIVE."""

    def __init__(self, graph_id: str) -> None:
        self.graph_id = graph_id
        super().__init__(f"Graph {graph_id!r} is not ACTIVE or does not exist in the connection pool.")


class GraphConnectionManager:
    """Singleton stored on ``app.state.graph_connection_manager`` during FastAPI lifespan.

    Routes interact only via the four public methods:
    ``get_connector()``, ``register()``, ``deregister()``, ``reconnect()``.
    """

    def __init__(self, session_factory: async_sessionmaker, encryption_key: str) -> None:
        self._session_factory = session_factory
        self._encryption_key = encryption_key
        self._registry: dict[str, BaseConnector] = {}  # graph_id → live connector
        self._retry_tasks: dict[str, asyncio.Task] = {}  # graph_id → backoff task
        self._health_task: asyncio.Task | None = None
        self._background_tasks: set[asyncio.Task] = set()  # fire-and-forget connects, kept alive until done

    def _spawn(self, coro: Coroutine[Any, Any, None]) -> asyncio.Task:
        """Create a fire-and-forget task and hold a strong reference until it finishes.

        Without retaining the reference the event loop may garbage-collect the
        task mid-flight (see Ruff RUF006 / asyncio docs).
        """
        task = asyncio.create_task(coro)
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)
        return task

    # -----------------------------------------------------------------------
    # Lifecycle — called from FastAPI lifespan only
    # -----------------------------------------------------------------------

    async def startup(self) -> None:
        """Load all non-INACTIVE graphs from DB and connect them concurrently."""
        async with self._session_factory() as session:
            graphs = await GraphModelStore().list_active(session)

        for graph in graphs:
            self._spawn(self._connect_graph(graph))

        self._health_task = asyncio.create_task(self._health_loop())
        logger.info("GraphConnectionManager started. Connecting %d graph(s).", len(graphs))

    async def shutdown(self) -> None:
        """Cancel background tasks and disconnect all connectors gracefully."""
        if self._health_task:
            self._health_task.cancel()

        for task in self._retry_tasks.values():
            task.cancel()

        for graph_id, connector in self._registry.items():
            try:
                await connector.disconnect()
            except Exception:
                logger.warning("Error disconnecting graph %r on shutdown.", graph_id)

        self._registry.clear()
        self._retry_tasks.clear()
        logger.info("GraphConnectionManager shut down.")

    # -----------------------------------------------------------------------
    # Public API — used by route handlers
    # -----------------------------------------------------------------------

    def get_connector(self, graph_id: str) -> BaseConnector:
        """Return the live connector for ``graph_id``.

        O(1) dict lookup — no DB hit on the hot path.

        Raises:
            GraphUnavailableError: If the graph is not ACTIVE (→ HTTP 503 in routes).
        """
        connector = self._registry.get(graph_id)
        if connector is None:
            raise GraphUnavailableError(graph_id)
        return connector

    async def register(self, graph: GraphConnection) -> None:
        """Connect a newly created graph and add it to the registry."""
        self._spawn(self._connect_graph(graph))

    async def deregister(self, graph_id: str) -> None:
        """Disconnect and remove a graph from the registry.

        Safe to call even if the graph was never registered.
        Also cancels any in-progress backoff retry task.
        """
        retry_task = self._retry_tasks.pop(graph_id, None)
        if retry_task:
            retry_task.cancel()

        connector = self._registry.pop(graph_id, None)
        if connector:
            try:
                await connector.disconnect()
            except Exception:
                logger.warning("Error disconnecting graph %r during deregister.", graph_id)

    async def reconnect(self, graph: GraphConnection) -> None:
        """Disconnect existing connector (if any) and reconnect with fresh config.

        Called on PATCH when URI/auth changes, or on POST /graphs/{id}/reconnect.
        """
        await self.deregister(graph.id)
        self._spawn(self._connect_graph(graph))

    # -----------------------------------------------------------------------
    # Internal — connection + retry
    # -----------------------------------------------------------------------

    async def _connect_graph(self, graph: GraphConnection) -> None:
        connector = _build_connector(graph, self._encryption_key)
        try:
            t0 = time.monotonic()
            await connector.connect()
            latency_ms = int((time.monotonic() - t0) * 1000)

            self._registry[graph.id] = connector
            logger.info("Graph %r connected (%d ms).", graph.id, latency_ms)

            async with self._session_factory() as session:
                await GraphModelStore().set_status(session, graph.id, "ACTIVE", latency_ms=latency_ms)
                await emit_event(
                    session,
                    action=event_actions.SYSTEM_CONNECTION_RECONNECT,
                    target_kind=event_actions.TARGET_CONNECTION,
                    target_id=graph.id,
                    graph_id=graph.graph_id,
                    actor_type=ActorType.system,
                    details={"ok": True, "latency_ms": latency_ms, "uri": graph.uri},
                )
                await session.commit()

                if graph.model_id is None:
                    await self._auto_introspect(session, graph, connector)

        except Exception as exc:
            logger.warning("Graph %r failed to connect: %s", graph.id, exc)
            async with self._session_factory() as session:
                await GraphModelStore().set_status(session, graph.id, "ERROR")
                await emit_event(
                    session,
                    action=event_actions.SYSTEM_CONNECTION_RECONNECT,
                    target_kind=event_actions.TARGET_CONNECTION,
                    target_id=graph.id,
                    graph_id=graph.graph_id,
                    actor_type=ActorType.system,
                    details={"ok": False, "error": str(exc), "uri": graph.uri},
                )
                await session.commit()

            existing = self._retry_tasks.pop(graph.id, None)
            if existing:
                existing.cancel()
            self._retry_tasks[graph.id] = asyncio.create_task(self._backoff_retry(graph))

    async def _backoff_retry(self, graph: GraphConnection) -> None:
        """Exponential backoff retry: 1s → 2s → 4s … capped at ``graph_retry_max_interval_s``.

        Always re-fetches the graph from DB so it picks up any URI/auth
        changes made while the retry loop was sleeping.
        """
        delay = 1
        while True:
            try:
                await asyncio.sleep(delay)
            except asyncio.CancelledError:
                return  # deregister() or reconnect() cancelled us

            async with self._session_factory() as session:
                fresh_graph = await GraphModelStore().get(session, graph.id)

            if fresh_graph is None or fresh_graph.status == "INACTIVE":
                self._retry_tasks.pop(graph.id, None)
                return  # graph deleted or disabled — stop retrying

            try:
                await self._connect_graph(fresh_graph)
                self._retry_tasks.pop(graph.id, None)
                return  # success
            except Exception:
                delay = min(delay * 2, settings.graph_retry_max_interval_s)
                logger.debug("Graph %r retry in %ds.", graph.id, delay)

    # -----------------------------------------------------------------------
    # Internal — health loop
    # -----------------------------------------------------------------------

    async def _health_loop(self) -> None:
        """Ping all ACTIVE connectors every ``graph_health_interval_s`` seconds."""
        while True:
            try:
                await asyncio.sleep(settings.graph_health_interval_s)
            except asyncio.CancelledError:
                return  # shutdown() cancelled us

            for graph_id in list(self._registry.keys()):  # snapshot to allow mid-loop mutation
                connector = self._registry.get(graph_id)
                if connector is None:
                    continue
                try:
                    t0 = time.monotonic()
                    await connector.health_check()
                    latency_ms = int((time.monotonic() - t0) * 1000)

                    async with self._session_factory() as session:
                        await GraphModelStore().set_status(session, graph_id, "ACTIVE", latency_ms=latency_ms)
                        await session.commit()

                except Exception as exc:
                    logger.warning("Health check failed for graph %r: %s", graph_id, exc)
                    self._registry.pop(graph_id, None)

                    async with self._session_factory() as session:
                        graph = await GraphModelStore().get(session, graph_id)
                        await GraphModelStore().set_status(session, graph_id, "ERROR")
                        await session.commit()

                    if graph:
                        existing = self._retry_tasks.pop(graph_id, None)
                        if existing:
                            existing.cancel()
                        self._retry_tasks[graph_id] = asyncio.create_task(self._backoff_retry(graph))

    # -----------------------------------------------------------------------
    # Introspection
    # -----------------------------------------------------------------------

    async def introspect(self, connection_id: str, connector: BaseConnector) -> None:
        """Re-run introspection in a **dedicated** session (safe to fire-and-forget).

        The HTTP route returns 202 immediately, so reusing the request-scoped
        session here would race the request teardown on the same asyncpg
        connection — "another operation is in progress". Open our own session
        and re-load the connection inside it.
        """
        async with self._session_factory() as session:
            connection = await GraphModelStore().get(session, connection_id)
            if connection is None:
                logger.warning("Introspect skipped — connection %r no longer exists.", connection_id)
                return
            await self._auto_introspect(session, connection, connector)

    async def _auto_introspect(self, session: AsyncSession, graph: GraphConnection, connector: BaseConnector) -> None:
        """Seed a GraphModel from live DB introspection on first successful connect.

        The introspected model is the graph's **default** model (RFC-019): it is
        owned by the Graph (``graph_id``) so it appears in ``/models``, and marked
        ``is_default`` so authored persona models layer on top of it.
        """
        try:
            parent = await session.get(Graph, graph.graph_id) if graph.graph_id else None
            schema_name = parent.name if parent else graph.uri

            model_store = ModelStore()
            schema = await model_store.create_graph_model(
                session,
                name=schema_name,
                description=f"Auto-introspected from {graph.uri}",
                graph_id=graph.graph_id,
                persona="domain",
                is_default=True,
            )

            introspector = Introspector(model_store)
            await introspector.introspect(session, model_id=schema.id, connector=connector)

            await GraphModelStore().set_schema(session, graph.id, schema.id)
            await emit_event(
                session,
                action=event_actions.SYSTEM_INTROSPECT_COMPLETE,
                target_kind=event_actions.TARGET_CONNECTION,
                target_id=graph.id,
                graph_id=graph.graph_id,
                actor_type=ActorType.system,
                details={"ok": True, "model_id": schema.id},
            )
            await session.commit()
            logger.info("Auto-introspected schema for graph %r (model_id=%s).", graph.id, schema.id)
        except Exception as exc:
            logger.warning("Auto-introspect failed for graph %r: %s", graph.id, exc, exc_info=True)
            # Non-fatal — graph stays ACTIVE, schema stays null, user can retry via /introspect
            try:
                await emit_event(
                    session,
                    action=event_actions.SYSTEM_INTROSPECT_COMPLETE,
                    target_kind=event_actions.TARGET_CONNECTION,
                    target_id=graph.id,
                    graph_id=graph.graph_id,
                    actor_type=ActorType.system,
                    details={"ok": False, "error": str(exc)},
                )
                await session.commit()
            except Exception:
                logger.warning("Failed to emit introspect-failure event for graph %r", graph.id)


# -----------------------------------------------------------------------
# Helper
# -----------------------------------------------------------------------


def _build_connector(graph: GraphConnection, encryption_key: str) -> BaseConnector:
    """Instantiate the vendor connector class from the persisted Graph record."""
    auth = decrypt_credentials(graph.auth_encrypted, encryption_key) if graph.auth_encrypted else {}
    ConnectorClass = import_class_from_dotted_path(graph.connector_class)
    return ConnectorClass(uri=graph.uri, **auth)
