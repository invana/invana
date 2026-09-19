"""Queries against ``graph_models`` — the model a Graph is described by."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from invana.apps.modeller.models import (
    GraphModel,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession
from invana.apps.modeller.querysets.base import VersionScopedQuerySet, _model_eager


class GraphModelQuerySet(VersionScopedQuerySet):
    async def create_graph_model(
        self,
        session: AsyncSession,
        *,
        name: str,
        graph_id: str | None = None,
        description: str = "",
        validation_mode: str = "strict",
        origin: str = "studio",
    ) -> GraphModel:
        graph_model = GraphModel(
            name=name,
            graph_id=graph_id,
            description=description,
            validation_mode=validation_mode,
            origin=origin,
        )
        session.add(graph_model)
        await session.flush()
        return graph_model

    async def get_introspected_model(self, session: AsyncSession, graph_id: str) -> GraphModel | None:
        """The graph's single system-managed 'global' model (origin=introspected), if any."""
        stmt = (
            select(GraphModel)
            .where(GraphModel.graph_id == graph_id, GraphModel.origin == "introspected")
            .options(*_model_eager())
            .order_by(GraphModel.created_at)
            .limit(1)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_graph_model(self, session: AsyncSession, model_id: str) -> GraphModel | None:
        stmt = select(GraphModel).where(GraphModel.id == model_id).options(*_model_eager())
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_graph_models(self, session: AsyncSession, graph_id: str | None = None) -> list[GraphModel]:
        stmt = select(GraphModel).options(*_model_eager()).order_by(GraphModel.created_at)
        if graph_id is not None:
            stmt = stmt.where(GraphModel.graph_id == graph_id)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def update_graph_model(
        self,
        session: AsyncSession,
        model_id: str,
        **fields: object,
    ) -> GraphModel | None:
        graph_model = await self.get_graph_model(session, model_id)
        if graph_model is None:
            return None
        for key, value in fields.items():
            if value is not None and hasattr(graph_model, key):
                setattr(graph_model, key, value)
        await session.flush()
        return graph_model

    async def delete_graph_model(self, session: AsyncSession, model_id: str) -> bool:
        graph_model = await self.get_graph_model(session, model_id)
        if graph_model is None:
            return False
        await session.delete(graph_model)
        await session.flush()
        return True

    # ------------------------------------------------------------------
    # Version CRUD
    # ------------------------------------------------------------------
