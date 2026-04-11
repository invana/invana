"""GraphModelStore — CRUD operations on the graphs table.

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

from invana.graphs.encryption import encrypt_credentials
from invana.graphs.models import Graph
from invana.graphs.schemas import GraphCreate, GraphUpdate

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class GraphModelStore:
    """Pure DB CRUD operations for the ``graphs`` table.

    Business logic (encryption, cascade-archive, 409 guards) belongs here
    because it is tightly coupled to the DB state of a single Graph row.
    ``GraphConnectionManager`` uses this store for all DB reads/writes.
    """

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    async def create(
        self,
        session: AsyncSession,
        *,
        data: GraphCreate,
        encryption_key: str,
    ) -> Graph:
        auth_encrypted = encrypt_credentials(data.auth, encryption_key) if data.auth else None
        graph = Graph(
            name=data.name,
            description=data.description,
            uri=data.uri,
            connector_class=data.connector_class,
            auth_encrypted=auth_encrypted,
            read_only=data.read_only,
            status="CONNECTING",
        )
        session.add(graph)
        await session.flush()
        return graph

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    async def get(self, session: AsyncSession, graph_id: str) -> Graph | None:
        stmt = select(Graph).where(Graph.id == graph_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_or_404(self, session: AsyncSession, graph_id: str) -> Graph:
        graph = await self.get(session, graph_id)
        if graph is None:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND,
                detail={"error": "graph_not_found", "graph_id": graph_id},
            )
        return graph

    async def list_all(self, session: AsyncSession) -> list[Graph]:
        """Return all graph rows (including INACTIVE) for the list API."""
        stmt = select(Graph).order_by(Graph.created_at)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def list_active(self, session: AsyncSession) -> list[Graph]:
        """Return all non-INACTIVE graphs — used by GraphConnectionManager.startup()."""
        stmt = select(Graph).where(Graph.status != "INACTIVE").order_by(Graph.created_at)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------

    async def update(
        self,
        session: AsyncSession,
        graph_id: str,
        *,
        data: GraphUpdate,
        encryption_key: str,
    ) -> Graph:
        graph = await self.get_or_404(session, graph_id)

        if data.name is not None:
            graph.name = data.name
        if data.description is not None:
            graph.description = data.description
        if data.read_only is not None:
            graph.read_only = data.read_only

        uri_or_auth_changed = False

        if data.uri is not None:
            graph.uri = data.uri
            uri_or_auth_changed = True

        if data.auth is not None:
            graph.auth_encrypted = encrypt_credentials(data.auth, encryption_key)
            uri_or_auth_changed = True

        if uri_or_auth_changed:
            # Signal the manager to reconnect
            graph.status = "CONNECTING"

        await session.flush()
        return graph

    # ------------------------------------------------------------------
    # Soft-delete
    # ------------------------------------------------------------------

    async def soft_delete(self, session: AsyncSession, graph_id: str) -> None:
        """Mark graph INACTIVE and archive its linked schema (if any)."""
        graph = await self.get_or_404(session, graph_id)
        graph.status = "INACTIVE"

        if graph.schema_id is not None:
            from invana.modeller.models import GraphSchema

            stmt = select(GraphSchema).where(GraphSchema.id == graph.schema_id)
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
        graph_id: str,
        status: str,
        *,
        latency_ms: int | None = None,
    ) -> None:
        """Targeted status update — no full object load needed."""
        graph = await self.get_or_404(session, graph_id)
        graph.status = status
        graph.last_health_check_at = datetime.now(UTC)
        if latency_ms is not None:
            graph.latency_ms = latency_ms
        await session.flush()

    async def set_schema(self, session: AsyncSession, graph_id: str, schema_id: str) -> None:
        """Set schema_id after auto-introspect — called once per graph."""
        graph = await self.get_or_404(session, graph_id)
        graph.schema_id = schema_id
        await session.flush()
