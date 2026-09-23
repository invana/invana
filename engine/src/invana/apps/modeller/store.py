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
    graph_model_qs = GraphModelQuerySet()
    graph_version_qs = GraphVersionQuerySet()
    property_key_qs = PropertyKeyQuerySet()
    node_type_qs = NodeTypeQuerySet()
    edge_type_qs = EdgeTypeQuerySet()
    constraint_qs = ConstraintQuerySet()
    index_qs = IndexQuerySet()
    schema_projection_qs = SchemaProjectionQuerySet()

    async def create_graph_model(self, *args, **kwargs):
        return await self.graph_model_qs.create_graph_model(*args, **kwargs)

    async def get_introspected_model(self, *args, **kwargs):
        return await self.graph_model_qs.get_introspected_model(*args, **kwargs)

    async def get_graph_model(self, *args, **kwargs):
        return await self.graph_model_qs.get_graph_model(*args, **kwargs)

    async def list_graph_models(self, *args, **kwargs):
        return await self.graph_model_qs.list_graph_models(*args, **kwargs)

    async def update_graph_model(self, *args, **kwargs):
        return await self.graph_model_qs.update_graph_model(*args, **kwargs)

    async def delete_graph_model(self, *args, **kwargs):
        return await self.graph_model_qs.delete_graph_model(*args, **kwargs)

    async def create_version(self, *args, **kwargs):
        return await self.graph_version_qs.create_version(*args, **kwargs)

    async def delete_draft_versions(self, *args, **kwargs):
        return await self.graph_version_qs.delete_draft_versions(*args, **kwargs)

    async def get_version(self, *args, **kwargs):
        return await self.graph_version_qs.get_version(*args, **kwargs)

    async def get_version_by_semver(self, *args, **kwargs):
        return await self.graph_version_qs.get_version_by_semver(*args, **kwargs)

    async def get_active_version(self, *args, **kwargs):
        return await self.graph_version_qs.get_active_version(*args, **kwargs)

    async def list_versions(self, *args, **kwargs):
        return await self.graph_version_qs.list_versions(*args, **kwargs)

    async def clone_version_contents(self, *args, **kwargs):
        return await self.graph_version_qs.clone_version_contents(*args, **kwargs)

    async def create_property_key(self, *args, **kwargs):
        return await self.property_key_qs.create_property_key(*args, **kwargs)

    async def get_property_key(self, *args, **kwargs):
        return await self.property_key_qs.get_property_key(*args, **kwargs)

    async def get_property_key_by_name(self, *args, **kwargs):
        return await self.property_key_qs.get_property_key_by_name(*args, **kwargs)

    async def list_property_keys(self, *args, **kwargs):
        return await self.property_key_qs.list_property_keys(*args, **kwargs)

    async def update_property_key(self, *args, **kwargs):
        return await self.property_key_qs.update_property_key(*args, **kwargs)

    async def delete_property_key(self, *args, **kwargs):
        return await self.property_key_qs.delete_property_key(*args, **kwargs)

    async def create_node_type(self, *args, **kwargs):
        return await self.node_type_qs.create_node_type(*args, **kwargs)

    async def get_node_type(self, *args, **kwargs):
        return await self.node_type_qs.get_node_type(*args, **kwargs)

    async def list_node_types(self, *args, **kwargs):
        return await self.node_type_qs.list_node_types(*args, **kwargs)

    async def update_node_type(self, *args, **kwargs):
        return await self.node_type_qs.update_node_type(*args, **kwargs)

    async def delete_node_type(self, *args, **kwargs):
        return await self.node_type_qs.delete_node_type(*args, **kwargs)

    async def create_edge_type(self, *args, **kwargs):
        return await self.edge_type_qs.create_edge_type(*args, **kwargs)

    async def get_edge_type(self, *args, **kwargs):
        return await self.edge_type_qs.get_edge_type(*args, **kwargs)

    async def list_edge_types(self, *args, **kwargs):
        return await self.edge_type_qs.list_edge_types(*args, **kwargs)

    async def update_edge_type(self, *args, **kwargs):
        return await self.edge_type_qs.update_edge_type(*args, **kwargs)

    async def delete_edge_type(self, *args, **kwargs):
        return await self.edge_type_qs.delete_edge_type(*args, **kwargs)

    async def create_constraint(self, *args, **kwargs):
        return await self.constraint_qs.create_constraint(*args, **kwargs)

    async def get_constraint(self, *args, **kwargs):
        return await self.constraint_qs.get_constraint(*args, **kwargs)

    async def list_constraints(self, *args, **kwargs):
        return await self.constraint_qs.list_constraints(*args, **kwargs)

    async def delete_constraint(self, *args, **kwargs):
        return await self.constraint_qs.delete_constraint(*args, **kwargs)

    async def create_index(self, *args, **kwargs):
        return await self.index_qs.create_index(*args, **kwargs)

    async def get_index(self, *args, **kwargs):
        return await self.index_qs.get_index(*args, **kwargs)

    async def list_indexes(self, *args, **kwargs):
        return await self.index_qs.list_indexes(*args, **kwargs)

    async def delete_index(self, *args, **kwargs):
        return await self.index_qs.delete_index(*args, **kwargs)

    async def create_projection(self, *args, **kwargs):
        return await self.schema_projection_qs.create_projection(*args, **kwargs)

    async def get_latest_projection(self, *args, **kwargs):
        return await self.schema_projection_qs.get_latest_projection(*args, **kwargs)
