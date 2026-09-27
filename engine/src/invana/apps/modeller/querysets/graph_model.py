"""Queries against ``graph_models`` — the model a Graph is described by."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import or_, select

from invana.apps.modeller.models import (
    GraphModel,
    GraphVersion,
    ModelLink,
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

    async def was_published(self, session: AsyncSession, model_id: str) -> bool:
        """True once any version was activated — an archived version was active once."""
        stmt = select(GraphVersion.id).where(
            GraphVersion.model_id == model_id,
            or_(GraphVersion.activated_at.is_not(None), GraphVersion.status.in_(("active", "archived"))),
        )
        return (await session.execute(stmt.limit(1))).first() is not None

    async def active_stitches_binding(
        self, session: AsyncSession, graph_id: str, model_id: str
    ) -> list[tuple[ModelLink, str, str]]:
        """Every active stitch with an end on one of this model's versions, with each end's model name."""
        return await self.active_stitches(session, graph_id, model_id=model_id)

    async def active_stitches(
        self, session: AsyncSession, graph_id: str, *, model_id: str | None = None
    ) -> list[tuple[ModelLink, str, str]]:
        """The Graph's active stitches — or only those binding ``model_id`` — with each end's model name."""
        stmt = select(ModelLink).where(ModelLink.graph_id == graph_id, ModelLink.status == "active")
        if model_id is not None:
            versions = select(GraphVersion.id).where(GraphVersion.model_id == model_id)
            stmt = stmt.where(or_(ModelLink.source_version_id.in_(versions), ModelLink.target_version_id.in_(versions)))
        links = list((await session.execute(stmt)).scalars().all())
        if not links:
            return []
        ends = {link.source_version_id for link in links} | {link.target_version_id for link in links}
        rows = await session.execute(
            select(GraphVersion.id, GraphModel.name)
            .join(GraphModel, GraphModel.id == GraphVersion.model_id)
            .where(GraphVersion.id.in_(ends))
        )
        names = dict(rows.tuples().all())
        return [
            (link, names.get(link.source_version_id, "?"), names.get(link.target_version_id, "?")) for link in links
        ]
