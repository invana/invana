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

from invana.graphs.encryption import decrypt_credentials
from invana.graphs.store import GraphModelStore
from invana.settings import settings
from invana.utils import import_class_from_dotted_path

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from invana.graph.connectors.base.connector import BaseConnector
    from invana.graphs.models import Graph

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

    # -----------------------------------------------------------------------
    # Lifecycle — called from FastAPI lifespan only
    # -----------------------------------------------------------------------

    async def startup(self) -> None:
        """Load all non-INACTIVE graphs from DB and connect them concurrently."""
        async with self._session_factory() as session:
            graphs = await GraphModelStore().list_active(session)

        for graph in graphs:
            asyncio.create_task(self._connect_graph(graph))

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

    async def register(self, graph: Graph) -> None:
        """Connect a newly created graph and add it to the registry."""
        asyncio.create_task(self._connect_graph(graph))

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

    async def reconnect(self, graph: Graph) -> None:
        """Disconnect existing connector (if any) and reconnect with fresh config.

        Called on PATCH when URI/auth changes, or on POST /graphs/{id}/reconnect.
        """
        await self.deregister(graph.id)
        asyncio.create_task(self._connect_graph(graph))

    # -----------------------------------------------------------------------
    # Internal — connection + retry
    # -----------------------------------------------------------------------

    async def _connect_graph(self, graph: Graph) -> None:
        connector = _build_connector(graph, self._encryption_key)
        try:
            t0 = time.monotonic()
            await connector.connect()
            latency_ms = int((time.monotonic() - t0) * 1000)

            self._registry[graph.id] = connector
            logger.info("Graph %r connected (%d ms).", graph.id, latency_ms)

            async with self._session_factory() as session:
                await GraphModelStore().set_status(session, graph.id, "ACTIVE", latency_ms=latency_ms)
                await session.commit()

                if graph.schema_id is None:
                    await self._auto_introspect(session, graph, connector)

        except Exception as exc:
            logger.warning("Graph %r failed to connect: %s", graph.id, exc)
            async with self._session_factory() as session:
                await GraphModelStore().set_status(session, graph.id, "ERROR")
                await session.commit()

            existing = self._retry_tasks.pop(graph.id, None)
            if existing:
                existing.cancel()
            self._retry_tasks[graph.id] = asyncio.create_task(self._backoff_retry(graph))

    async def _backoff_retry(self, graph: Graph) -> None:
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
    # Internal — auto-introspect
    # -----------------------------------------------------------------------

    async def _auto_introspect(self, session: AsyncSession, graph: Graph, connector: BaseConnector) -> None:
        """Seed a GraphSchema from live DB introspection on first successful connect."""
        try:
            from invana.modeller.introspector import Introspector
            from invana.modeller.store import SchemaStore

            schema_store = SchemaStore()
            schema = await schema_store.create_schema(
                session,
                name=graph.name,
                description=f"Auto-introspected from {graph.uri}",
            )

            introspector = Introspector(schema_store)
            await introspector.introspect(session, schema_id=schema.id, connector=connector)

            await GraphModelStore().set_schema(session, graph.id, schema.id)
            await session.commit()
            logger.info("Auto-introspected schema for graph %r (schema_id=%s).", graph.id, schema.id)
        except Exception as exc:
            logger.warning("Auto-introspect failed for graph %r: %s", graph.id, exc)
            # Non-fatal — graph stays ACTIVE, schema stays null, user can retry via /introspect


# -----------------------------------------------------------------------
# Helper
# -----------------------------------------------------------------------


def _build_connector(graph: Graph, encryption_key: str) -> BaseConnector:
    """Instantiate the vendor connector class from the persisted Graph record."""
    auth = decrypt_credentials(graph.auth_encrypted, encryption_key) if graph.auth_encrypted else {}
    ConnectorClass = import_class_from_dotted_path(graph.connector_class)
    return ConnectorClass(uri=graph.uri, **auth)
