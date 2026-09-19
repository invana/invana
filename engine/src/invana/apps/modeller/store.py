"""``ModelStore`` — a façade over the eight modeller querysets.

Was one class with **42 methods over eleven models**, the third-largest file in
the engine (migration-plan §12.2). The queries now live one file per model under
``querysets/``; this forwards to them so the forty-odd call sites migrate
gradually rather than in one commit.

New code calls the queryset it wants. This class is the compatibility shim, and
it is deleted when nothing imports it.
"""

from __future__ import annotations

from invana.apps.modeller.querysets import (
    ConstraintQuerySet,
    EdgeTypeQuerySet,
    GraphModelQuerySet,
    GraphVersionQuerySet,
    IndexQuerySet,
    NodeTypeQuerySet,
    PropertyKeyQuerySet,
    SchemaProjectionQuerySet,
)


class ModelStore:
    graph_model = GraphModelQuerySet()
    graph_version = GraphVersionQuerySet()
    property_key = PropertyKeyQuerySet()
    node_type = NodeTypeQuerySet()
    edge_type = EdgeTypeQuerySet()
    constraint = ConstraintQuerySet()
    index = IndexQuerySet()
    schema_projection = SchemaProjectionQuerySet()

    async def create_graph_model(self, *args, **kwargs):
        return await self.graph_model.create_graph_model(*args, **kwargs)

    async def get_introspected_model(self, *args, **kwargs):
        return await self.graph_model.get_introspected_model(*args, **kwargs)

    async def get_graph_model(self, *args, **kwargs):
        return await self.graph_model.get_graph_model(*args, **kwargs)

    async def list_graph_models(self, *args, **kwargs):
        return await self.graph_model.list_graph_models(*args, **kwargs)

    async def update_graph_model(self, *args, **kwargs):
        return await self.graph_model.update_graph_model(*args, **kwargs)

    async def delete_graph_model(self, *args, **kwargs):
        return await self.graph_model.delete_graph_model(*args, **kwargs)

    async def create_version(self, *args, **kwargs):
        return await self.graph_version.create_version(*args, **kwargs)

    async def delete_draft_versions(self, *args, **kwargs):
        return await self.graph_version.delete_draft_versions(*args, **kwargs)

    async def get_version(self, *args, **kwargs):
        return await self.graph_version.get_version(*args, **kwargs)

    async def get_version_by_semver(self, *args, **kwargs):
        return await self.graph_version.get_version_by_semver(*args, **kwargs)

    async def get_active_version(self, *args, **kwargs):
        return await self.graph_version.get_active_version(*args, **kwargs)

    async def list_versions(self, *args, **kwargs):
        return await self.graph_version.list_versions(*args, **kwargs)

    async def clone_version_contents(self, *args, **kwargs):
        return await self.graph_version.clone_version_contents(*args, **kwargs)

    async def create_property_key(self, *args, **kwargs):
        return await self.property_key.create_property_key(*args, **kwargs)

    async def get_property_key(self, *args, **kwargs):
        return await self.property_key.get_property_key(*args, **kwargs)

    async def get_property_key_by_name(self, *args, **kwargs):
        return await self.property_key.get_property_key_by_name(*args, **kwargs)

    async def list_property_keys(self, *args, **kwargs):
        return await self.property_key.list_property_keys(*args, **kwargs)

    async def update_property_key(self, *args, **kwargs):
        return await self.property_key.update_property_key(*args, **kwargs)

    async def delete_property_key(self, *args, **kwargs):
        return await self.property_key.delete_property_key(*args, **kwargs)

    async def create_node_type(self, *args, **kwargs):
        return await self.node_type.create_node_type(*args, **kwargs)

    async def get_node_type(self, *args, **kwargs):
        return await self.node_type.get_node_type(*args, **kwargs)

    async def list_node_types(self, *args, **kwargs):
        return await self.node_type.list_node_types(*args, **kwargs)

    async def update_node_type(self, *args, **kwargs):
        return await self.node_type.update_node_type(*args, **kwargs)

    async def delete_node_type(self, *args, **kwargs):
        return await self.node_type.delete_node_type(*args, **kwargs)

    async def create_edge_type(self, *args, **kwargs):
        return await self.edge_type.create_edge_type(*args, **kwargs)

    async def get_edge_type(self, *args, **kwargs):
        return await self.edge_type.get_edge_type(*args, **kwargs)

    async def list_edge_types(self, *args, **kwargs):
        return await self.edge_type.list_edge_types(*args, **kwargs)

    async def update_edge_type(self, *args, **kwargs):
        return await self.edge_type.update_edge_type(*args, **kwargs)

    async def delete_edge_type(self, *args, **kwargs):
        return await self.edge_type.delete_edge_type(*args, **kwargs)

    async def create_constraint(self, *args, **kwargs):
        return await self.constraint.create_constraint(*args, **kwargs)

    async def get_constraint(self, *args, **kwargs):
        return await self.constraint.get_constraint(*args, **kwargs)

    async def list_constraints(self, *args, **kwargs):
        return await self.constraint.list_constraints(*args, **kwargs)

    async def delete_constraint(self, *args, **kwargs):
        return await self.constraint.delete_constraint(*args, **kwargs)

    async def create_index(self, *args, **kwargs):
        return await self.index.create_index(*args, **kwargs)

    async def get_index(self, *args, **kwargs):
        return await self.index.get_index(*args, **kwargs)

    async def list_indexes(self, *args, **kwargs):
        return await self.index.list_indexes(*args, **kwargs)

    async def delete_index(self, *args, **kwargs):
        return await self.index.delete_index(*args, **kwargs)

    async def create_projection(self, *args, **kwargs):
        return await self.schema_projection.create_projection(*args, **kwargs)

    async def get_latest_projection(self, *args, **kwargs):
        return await self.schema_projection.get_latest_projection(*args, **kwargs)
