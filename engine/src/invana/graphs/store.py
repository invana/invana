"""GraphConnectionStore — CRUD operations on the ``graph_connections`` table.

All methods accept an ``AsyncSession`` so the caller controls the transaction
boundary. The store never commits — callers should ``await session.commit()``
when appropriate.
"""

from __future__ import annotations

from datetime import UTC, datetime
from http import HTTPStatus
from typing import TYPE_CHECKING

from fastapi import HTTPException
from sqlalchemy import select

from invana.graphs.compatibility import compatibility_status_for
from invana.graphs.encryption import encrypt_credentials
from invana.graphs.models import GraphConnection
from invana.graphs.schemas import GraphConnectionCreate, GraphConnectionUpdate
from invana.modeller.models import GraphModel

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class GraphConnectionStore:
    """Pure DB CRUD operations for the ``graph_connections`` table.

    Business logic (encryption, cascade-archive, 409 guards) lives here
    because it is tightly coupled to the DB state of a single GraphConnection row.
    ``GraphConnectionManager`` uses this store for all DB reads/writes.
    """

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    async def create(
        self,
        session: AsyncSession,
        *,
        data: GraphConnectionCreate,
        encryption_key: str,
    ) -> GraphConnection:
        auth_encrypted = encrypt_credentials(data.auth, encryption_key) if data.auth else None
        # A manually-declared version (RFC-022) is stored as a fallback; a successful
        # auto-detect on connect overrides it (see GraphConnectionManager._persist_version).
        declared = (data.server_version or "").strip() or None
        connection = GraphConnection(
            uri=data.uri,
            connector_class=data.connector_class,
            auth_encrypted=auth_encrypted,
            read_only=data.read_only,
            status="CONNECTING",
            server_version=declared,
            server_version_source="declared" if declared else None,
            compatibility_status=(compatibility_status_for(data.connector_class, declared) if declared else None),
        )
        session.add(connection)
        await session.flush()
        return connection

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    async def get(self, session: AsyncSession, connection_id: str) -> GraphConnection | None:
        stmt = select(GraphConnection).where(GraphConnection.id == connection_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_or_404(self, session: AsyncSession, connection_id: str) -> GraphConnection:
        connection = await self.get(session, connection_id)
        if connection is None:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND,
                detail={"error": "graph_connection_not_found", "id": connection_id},
            )
        return connection

    async def list_all(self, session: AsyncSession) -> list[GraphConnection]:
        """Return all rows (including INACTIVE) for the list API."""
        stmt = select(GraphConnection).order_by(GraphConnection.created_at)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def list_active(self, session: AsyncSession) -> list[GraphConnection]:
        """Return all non-INACTIVE connections — used by GraphConnectionManager.startup()."""
        stmt = select(GraphConnection).where(GraphConnection.status != "INACTIVE").order_by(GraphConnection.created_at)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------

    async def update(
        self,
        session: AsyncSession,
        connection_id: str,
        *,
        data: GraphConnectionUpdate,
        encryption_key: str,
    ) -> GraphConnection:
        connection = await self.get_or_404(session, connection_id)

        if data.read_only is not None:
            connection.read_only = data.read_only

        uri_or_auth_changed = False

        if data.uri is not None:
            connection.uri = data.uri
            uri_or_auth_changed = True

        if data.auth is not None:
            connection.auth_encrypted = encrypt_credentials(data.auth, encryption_key)
            uri_or_auth_changed = True

        if uri_or_auth_changed:
            # Signal the manager to reconnect
            connection.status = "CONNECTING"

        await session.flush()
        return connection

    # ------------------------------------------------------------------
    # Soft-delete
    # ------------------------------------------------------------------

    async def soft_delete(self, session: AsyncSession, connection_id: str) -> None:
        """Mark connection INACTIVE and archive its linked schema (if any)."""
        connection = await self.get_or_404(session, connection_id)
        connection.status = "INACTIVE"

        if connection.model_id is not None:
            stmt = select(GraphModel).where(GraphModel.id == connection.model_id)
            result = await session.execute(stmt)
            schema = result.scalar_one_or_none()
            if schema is not None:
                # Archive all active versions
                for version in schema.versions:
                    if version.status == "active":
                        version.status = "archived"

        await session.flush()

    # ------------------------------------------------------------------
    # Status helpers — called frequently by GraphConnectionManager
    # ------------------------------------------------------------------

    async def set_status(
        self,
        session: AsyncSession,
        connection_id: str,
        status: str,
        *,
        latency_ms: int | None = None,
    ) -> None:
        """Targeted status update — no full object load needed."""
        connection = await self.get_or_404(session, connection_id)
        connection.status = status
        connection.last_health_check_at = datetime.now(UTC)
        if latency_ms is not None:
            connection.latency_ms = latency_ms
        await session.flush()

    async def set_schema(self, session: AsyncSession, connection_id: str, model_id: str) -> None:
        """Set model_id after auto-introspect — called once per connection."""
        connection = await self.get_or_404(session, connection_id)
        connection.model_id = model_id
        await session.flush()

    async def set_version(
        self,
        session: AsyncSession,
        connection_id: str,
        *,
        server_version: str | None,
        source: str,
        compatibility_status: str,
    ) -> bool:
        """Persist the detected/declared server version + compatibility (RFC-022).

        Resets ``version_acknowledged`` whenever the version actually changes — a new
        version must be re-acknowledged. Returns ``True`` when the version changed.
        """
        connection = await self.get_or_404(session, connection_id)
        changed = connection.server_version != server_version
        connection.server_version = server_version
        connection.server_version_source = source
        connection.compatibility_status = compatibility_status
        if changed:
            connection.version_acknowledged = False
        await session.flush()
        return changed

    async def acknowledge_version(self, session: AsyncSession, connection_id: str) -> GraphConnection:
        """Mark an UNTESTED version as accepted-at-risk — lifts the version read-only."""
        connection = await self.get_or_404(session, connection_id)
        connection.version_acknowledged = True
        await session.flush()
        return connection


# Back-compat alias — old code referring to GraphModelStore continues to work.
GraphModelStore = GraphConnectionStore
