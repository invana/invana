"""The reads the participant catalogue is built from.

Everything here is a query against a table another app owns — published model
versions, their property keys, the stitches between them, the configured
providers. Govern reads them and stores nothing: what a Graph may address is a
view over what it already declares
([GV21](docs/for-developers/modules/govern/spec.md)).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from invana.apps.llm_providers.models import LLMModel, LLMModelStatus, LLMProvider
from invana.apps.modeller.models import (
    EdgeTypeDefinition,
    GraphModel,
    GraphVersion,
    ModelLink,
    NodeTypeDefinition,
    PropertyKeyDefinition,
)
from invana.apps.modeller.solve import ANCHOR_EDGE


class CatalogueQuerySet:
    async def published_versions(
        self, session: AsyncSession, graph_id: str
    ) -> list[tuple[str, str | None, dict[str, Any], list[str]]]:
        """``(model name, version label, axes, property names)`` per active version.

        Only ``active`` versions: a draft is not something a run can be pointed
        at, so offering one in a world's picker would be offering a narrowing
        that cannot be enforced.
        """
        stmt = (
            select(GraphVersion.id, GraphModel.name, GraphVersion.version, GraphVersion.axes)
            .join(GraphModel, GraphModel.id == GraphVersion.model_id)
            .where(GraphModel.graph_id == graph_id, GraphVersion.status == "active")
            .order_by(GraphModel.name, GraphVersion.created_at)
        )
        rows = (await session.execute(stmt)).all()
        if not rows:
            return []

        keys = (
            await session.execute(
                select(PropertyKeyDefinition.version_id, PropertyKeyDefinition.name)
                .where(PropertyKeyDefinition.version_id.in_([row[0] for row in rows]))
                .order_by(PropertyKeyDefinition.name)
            )
        ).all()
        by_version: dict[str, list[str]] = {}
        for version_id, name in keys:
            by_version.setdefault(version_id, []).append(name)

        return [
            (model_name, version_label, axes or {}, by_version.get(version_id, []))
            for version_id, model_name, version_label, axes in rows
        ]

    async def published_type_names(
        self, session: AsyncSession, graph_id: str
    ) -> list[tuple[str, str | None, dict[str, Any], list[str]]]:
        """``(model name, version label, axes, type names)`` per active version.

        The types are what makes an authored model a **bound** rather than a
        label: a rule naming ``Deals@*`` narrows the types ``Deals`` declares,
        applied to the version the run is actually grounded on
        ([GV33](docs/for-developers/modules/govern/spec.md)). Node and edge
        types come back in one list because the connector bounds both and a
        lens that reached only nodes would be a bound with a hole in it.

        Separate from :meth:`published_versions`, which reads *property* names
        for the exclusion picker. Two reads rather than one wide join, because
        the picker wants properties per version and this wants types, and a
        row-multiplying join of both is the sort of read that is cheap until a
        Graph has thirty models.
        """
        stmt = (
            select(GraphVersion.id, GraphModel.name, GraphVersion.version, GraphVersion.axes)
            .join(GraphModel, GraphModel.id == GraphVersion.model_id)
            .where(GraphModel.graph_id == graph_id, GraphVersion.status == "active")
            .order_by(GraphModel.name, GraphVersion.created_at)
        )
        rows = (await session.execute(stmt)).all()
        if not rows:
            return []

        version_ids = [row[0] for row in rows]
        by_version: dict[str, list[str]] = {}
        for model in (NodeTypeDefinition, EdgeTypeDefinition):
            found = (
                await session.execute(
                    select(model.version_id, model.name).where(model.version_id.in_(version_ids)).order_by(model.name)
                )
            ).all()
            for version_id, name in found:
                by_version.setdefault(version_id, []).append(name)

        return [
            (model_name, version_label, axes or {}, by_version.get(version_id, []))
            for version_id, model_name, version_label, axes in rows
        ]

    async def version_label(self, session: AsyncSession, version_id: str) -> tuple[str, str | None] | None:
        """``(model name, version label)`` for one version — the address's two parts.

        A separate read because ``GraphVersion.schema`` is lazy and a run holds
        the version, not the model: touching the relationship in an async
        session is a ``MissingGreenlet``, and an address that cannot be built is
        a participant that cannot be governed.
        """
        stmt = (
            select(GraphModel.name, GraphVersion.version)
            .join(GraphModel, GraphModel.id == GraphVersion.model_id)
            .where(GraphVersion.id == version_id)
        )
        row = (await session.execute(stmt)).first()
        return (row[0], row[1]) if row else None

    async def stitch_names(self, session: AsyncSession, graph_id: str) -> list[str]:
        """The declared links, addressed ``graph_data/stitch/<source>_<target>``,
        with ``@<edge_type>`` on a relationship
        ([GV24](docs/for-developers/modules/govern/spec.md)).

        The edge type is part of the address because it is part of the identity:
        ``uq_model_link`` keys a stitch on its endpoints **and** ``edge_type``, so
        ``Tweet -[LINKS_TO]-> Article`` and ``Tweet -[ABOUT]-> Article`` are two
        participants. Without it they collapse onto one string, the catalogue
        returns it twice, and no rule can reach one without reaching the other.

        An anchor carries no edge type and keeps the bare pair. A stitch is
        permitted or denied whole either way — *no links* is a real narrowing,
        and it is what `Nothing leaves` and half the worlds in the design say.
        """
        return [name for name, _ in await self.stitch_bindings(session, graph_id)]

    async def stitch_bindings(self, session: AsyncSession, graph_id: str) -> list[tuple[str, str]]:
        """``(stitch name, the edge type it writes)`` — the address and what it bounds.

        **Only stitches whose endpoint versions are both still active.** A model
        that republishes leaves its old stitches behind, bound to versions
        nothing is grounded on any more: they are declarations a run can never
        engage, and offering one in the picker is offering a bound that cannot
        bind. It is also the second way two rows reach one address —
        [GV24](docs/for-developers/modules/govern/spec.md) removed the first by
        putting the edge type in the address, and the address carries no
        version, so the same stitch re-declared against a new version collides
        with its predecessor. Filtering to live endpoints removes both, and the
        ``dict`` below removes any that are left.

        An anchor writes ``SAME_AS`` (``modeller.solve.ANCHOR_EDGE``), so naming
        one anchor bounds the type every anchor writes. That is the type grain
        being coarser than the stitch grain rather than a mistake — the
        connector bounds types, and a finer bound would need an edge property
        no anchor carries.
        """
        source = aliased(GraphVersion)
        target = aliased(GraphVersion)
        stmt = (
            select(ModelLink.source_type, ModelLink.target_type, ModelLink.edge_type)
            .join(source, source.id == ModelLink.source_version_id)
            .join(target, target.id == ModelLink.target_version_id)
            .where(
                ModelLink.graph_id == graph_id,
                ModelLink.status == "active",
                source.status == "active",
                target.status == "active",
            )
            .order_by(ModelLink.source_type, ModelLink.target_type, ModelLink.edge_type)
        )
        rows = (await session.execute(stmt)).all()
        # A dict rather than a set: the order the query gave is what the picker
        # lists, and a set would reshuffle it on every call.
        out: dict[str, str] = {}
        for source_type, target_type, edge_type in rows:
            name = (
                f"{source_type}_{target_type}@{edge_type}".lower()
                if edge_type
                else f"{source_type}_{target_type}".lower()
            )
            out.setdefault(name, edge_type or ANCHOR_EDGE)
        return list(out.items())

    async def provider_models(self, session: AsyncSession, graph_id: str) -> list[tuple[str, str]]:
        """``(provider row name, model id)`` — the two segments after ``llm/``."""
        return [(name, model_id) for _, name, model_id in await self.provider_rows(session, graph_id)]

    async def provider_rows(self, session: AsyncSession, graph_id: str) -> list[tuple[str, str, str]]:
        """``(model row id, provider name, model id)`` for every model on offer.

        One row per **model**, not per provider: an endpoint offering three
        models is three participants, because three is how many addresses a
        rule can name ([GV9](docs/for-developers/modules/govern/spec.md)).

        The id that rides along is the ``llm_models`` id, because that is what a
        run records and what resolves both address segments
        ([PM15](docs/for-developers/modules/agents/features/providers-and-models.md)).
        The name is the provider's own column now — it is no longer derived from
        the kind, so two endpoints on one vendor are two participants with two
        keys and two names somebody chose ([PM10](docs/for-developers/modules/agents/features/providers-and-models.md)).
        """
        stmt = (
            select(LLMModel.id, LLMProvider.name, LLMModel.model_id)
            .join(LLMProvider, LLMProvider.id == LLMModel.provider_id)
            .where(LLMProvider.graph_id == graph_id, LLMModel.status == LLMModelStatus.active.value)
            .order_by(LLMProvider.created_at, LLMModel.created_at)
        )
        return [(row_id, name, model_id) for row_id, name, model_id in (await session.execute(stmt)).all()]
