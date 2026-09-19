"""Queries against ``graph_versions`` — a model's drafts and published versions."""

from __future__ import annotations

import copy
from typing import TYPE_CHECKING

from sqlalchemy import select

from invana.apps.modeller.models import (
    GraphVersion,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession
from invana.apps.modeller.querysets.base import VersionScopedQuerySet, _version_eager


class GraphVersionQuerySet(VersionScopedQuerySet):
    async def create_version(
        self,
        session: AsyncSession,
        *,
        model_id: str,
        based_on: str | None = None,
    ) -> GraphVersion:
        # Ensure no existing draft
        stmt = select(GraphVersion).where(GraphVersion.model_id == model_id, GraphVersion.status == "draft")
        result = await session.execute(stmt)
        existing_draft = result.scalar_one_or_none()
        if existing_draft is not None:
            msg = "A draft version already exists for this schema."
            raise ValueError(msg)

        version = GraphVersion(model_id=model_id)
        session.add(version)
        await session.flush()

        # Clone from an existing version if requested
        if based_on is not None:
            source = await self.get_version_by_semver(session, model_id, based_on)
            if source is None:
                msg = f"Source version '{based_on}' not found."
                raise ValueError(msg)
            await self._clone_version_contents(session, source, version)

        return version

    async def delete_draft_versions(self, session: AsyncSession, model_id: str) -> int:
        """Delete any draft versions of a model. Returns how many were removed.

        Used by introspection of the system-managed ``global`` model, which is
        fully rebuilt on every run: a stale draft left by a prior interrupted
        introspect would otherwise trip ``create_version``'s one-draft guard and
        block all future refreshes. ORM delete so version children cascade.
        """
        stmt = select(GraphVersion).where(GraphVersion.model_id == model_id, GraphVersion.status == "draft")
        result = await session.execute(stmt)
        drafts = list(result.scalars().all())
        for draft in drafts:
            await session.delete(draft)
        if drafts:
            await session.flush()
        return len(drafts)

    async def get_version(self, session: AsyncSession, version_id: str) -> GraphVersion | None:
        """Load a version and its whole type tree, as the database has it now.

        ``populate_existing`` because a caller that just staged or discarded
        something reads the version back in the same session: without it the
        already-loaded collections come back as they were before the write, and
        the staged set would report a change that is no longer there.
        """
        stmt = (
            select(GraphVersion)
            .where(GraphVersion.id == version_id)
            .options(*_version_eager())
            .execution_options(populate_existing=True)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_version_by_semver(self, session: AsyncSession, model_id: str, semver: str) -> GraphVersion | None:
        stmt = (
            select(GraphVersion)
            .where(GraphVersion.model_id == model_id, GraphVersion.version == semver)
            .options(*_version_eager())
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active_version(self, session: AsyncSession, model_id: str) -> GraphVersion | None:
        stmt = (
            select(GraphVersion)
            .where(GraphVersion.model_id == model_id, GraphVersion.status == "active")
            .options(*_version_eager())
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_versions(self, session: AsyncSession, model_id: str) -> list[GraphVersion]:
        stmt = select(GraphVersion).where(GraphVersion.model_id == model_id).order_by(GraphVersion.created_at)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # Property Key CRUD
    # ------------------------------------------------------------------

    async def clone_version_contents(
        self,
        session: AsyncSession,
        source: GraphVersion,
        target: GraphVersion,
    ) -> None:
        """Public entry point — discarding a staged set rebuilds a draft this way."""
        await self._clone_version_contents(session, source, target)

    async def _clone_version_contents(
        self,
        session: AsyncSession,
        source: GraphVersion,
        target: GraphVersion,
    ) -> None:
        """Deep-clone property keys, node types, edge types, constraints, and indexes."""
        # Reload with eager loading
        source = await self.get_version(session, source.id)
        if source is None:
            return

        # Clone property keys first (types and mappings depend on them)
        for pk in source.property_keys:
            await self.property_keys.create_property_key(
                session,
                version_id=target.id,
                name=pk.name,
                type=pk.type,
                value_cardinality=pk.value_cardinality,
                description=pk.description,
                validation_rules=[
                    {"rule_type": r.rule_type, "params": copy.deepcopy(r.params)} for r in pk.validation_rules
                ],
            )

        # Clone node types
        for nt in source.node_types:
            mappings = [
                {
                    "property_key": m.property_key.name,
                    "default_value": m.default_value,
                    "sort_order": m.sort_order,
                    "validation_rules": [
                        {"rule_type": r.rule_type, "params": copy.deepcopy(r.params)} for r in m.validation_rules
                    ],
                }
                for m in nt.property_mappings
            ]
            await self.node_types.create_node_type(
                session,
                version_id=target.id,
                name=nt.name,
                description=nt.description,
                parent_type=nt.parent_type,
                is_abstract=nt.is_abstract,
                validation_mode=nt.validation_mode,
                property_mappings=mappings,
            )

        # Clone edge types
        for et in source.edge_types:
            mappings = [
                {
                    "property_key": m.property_key.name,
                    "default_value": m.default_value,
                    "sort_order": m.sort_order,
                    "validation_rules": [
                        {"rule_type": r.rule_type, "params": copy.deepcopy(r.params)} for r in m.validation_rules
                    ],
                }
                for m in et.property_mappings
            ]
            await self.edge_types.create_edge_type(
                session,
                version_id=target.id,
                name=et.name,
                description=et.description,
                source_node_types=copy.deepcopy(et.source_node_types),
                target_node_types=copy.deepcopy(et.target_node_types),
                multiplicity=et.multiplicity,
                property_mappings=mappings,
            )

        # Clone constraints
        for c in source.constraints:
            await self.constraints.create_constraint(
                session,
                version_id=target.id,
                name=c.name,
                target_kind=c.target_kind,
                target_label=c.target_label,
                constraint_type=c.constraint_type,
                properties=copy.deepcopy(c.properties),
            )

        # Clone indexes
        for idx in source.indexes:
            await self.indexes.create_index(
                session,
                version_id=target.id,
                name=idx.name,
                target_kind=idx.target_kind,
                target_label=idx.target_label,
                properties=copy.deepcopy(idx.properties),
                index_type=idx.index_type,
                index_options=copy.deepcopy(idx.index_options) if idx.index_options else None,
            )
