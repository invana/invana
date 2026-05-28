"""Tests for ModelStore CRUD operations."""

import pytest


@pytest.mark.asyncio
class TestSchemaCRUD:
    async def test_create_schema(self, session, store):
        schema = await store.create_graph_model(session, name="Test Schema", description="A test")
        assert schema.id is not None
        assert schema.name == "Test Schema"
        assert schema.description == "A test"
        assert schema.validation_mode == "strict"

    async def test_get_schema(self, session, store):
        schema = await store.create_graph_model(session, name="Get Test")
        await session.commit()
        fetched = await store.get_graph_model(session, schema.id)
        assert fetched is not None
        assert fetched.name == "Get Test"

    async def test_list_schemas(self, session, store):
        await store.create_graph_model(session, name="Schema A")
        await store.create_graph_model(session, name="Schema B")
        await session.commit()
        schemas = await store.list_graph_models(session)
        assert len(schemas) >= 2
        names = [s.name for s in schemas]
        assert "Schema A" in names
        assert "Schema B" in names

    async def test_update_schema(self, session, store):
        schema = await store.create_graph_model(session, name="Before")
        await session.commit()
        updated = await store.update_graph_model(session, schema.id, name="After")
        assert updated is not None
        assert updated.name == "After"

    async def test_delete_schema(self, session, store):
        schema = await store.create_graph_model(session, name="Delete Me")
        await session.commit()
        result = await store.delete_graph_model(session, schema.id)
        assert result is True
        await session.commit()
        fetched = await store.get_graph_model(session, schema.id)
        assert fetched is None

    async def test_delete_nonexistent_schema(self, session, store):
        result = await store.delete_graph_model(session, "nonexistent-id")
        assert result is False

    async def test_get_introspected_model(self, session, store):
        # Authored models default to origin="studio" and are not returned.
        authored = await store.create_graph_model(session, name="authored")
        assert authored.origin == "studio"
        glob = await store.create_graph_model(session, name="global", origin="introspected")
        await session.commit()

        found = await store.get_introspected_model(session, None)
        assert found is not None
        assert found.id == glob.id
        # A graph with no introspected model returns None.
        assert await store.get_introspected_model(session, "no-such-graph") is None


@pytest.mark.asyncio
class TestVersionCRUD:
    async def test_create_version(self, session, store):
        schema = await store.create_graph_model(session, name="V Test")
        await session.commit()
        version = await store.create_version(session, model_id=schema.id)
        assert version.id is not None
        assert version.status == "draft"
        assert version.version is None

    async def test_only_one_draft(self, session, store):
        schema = await store.create_graph_model(session, name="Draft Test")
        await session.commit()
        await store.create_version(session, model_id=schema.id)
        with pytest.raises(ValueError, match="draft version already exists"):
            await store.create_version(session, model_id=schema.id)

    async def test_get_version(self, session, store):
        schema = await store.create_graph_model(session, name="V Get")
        await session.commit()
        version = await store.create_version(session, model_id=schema.id)
        await session.commit()
        fetched = await store.get_version(session, version.id)
        assert fetched is not None
        assert fetched.id == version.id

    async def test_list_versions(self, session, store):
        schema = await store.create_graph_model(session, name="V List")
        await session.commit()
        await store.create_version(session, model_id=schema.id)
        await session.commit()
        versions = await store.list_versions(session, schema.id)
        assert len(versions) == 1


@pytest.mark.asyncio
class TestPropertyKeyCRUD:
    async def test_create_property_key(self, session, store):
        schema = await store.create_graph_model(session, name="PK Test")
        await session.commit()
        version = await store.create_version(session, model_id=schema.id)
        await session.commit()

        pk = await store.create_property_key(
            session,
            version_id=version.id,
            name="name",
            type="string",
        )
        assert pk.id is not None
        assert pk.name == "name"
        assert pk.type == "string"
        assert pk.value_cardinality == "SINGLE"

    async def test_list_property_keys(self, session, store):
        schema = await store.create_graph_model(session, name="PK List")
        await session.commit()
        version = await store.create_version(session, model_id=schema.id)
        await session.commit()

        await store.create_property_key(session, version_id=version.id, name="name", type="string")
        await store.create_property_key(session, version_id=version.id, name="age", type="integer")
        await session.commit()

        keys = await store.list_property_keys(session, version.id)
        assert len(keys) == 2

    async def test_update_property_key(self, session, store):
        schema = await store.create_graph_model(session, name="PK Update")
        await session.commit()
        version = await store.create_version(session, model_id=schema.id)
        await session.commit()
        pk = await store.create_property_key(session, version_id=version.id, name="cost", type="string")
        await session.commit()

        updated = await store.update_property_key(session, pk.id, name="price", type="float")
        assert updated is not None
        assert updated.name == "price"
        assert updated.type == "float"

    async def test_update_property_key_rejected_on_active_version(self, session, store):
        from invana.modeller.versioner import Versioner

        schema = await store.create_graph_model(session, name="PK Immutable")
        await session.commit()
        version = await store.create_version(session, model_id=schema.id)
        await session.commit()
        pk = await store.create_property_key(session, version_id=version.id, name="name", type="string")
        await session.commit()

        activated = await Versioner(store).activate(session, version_id=version.id)
        await session.commit()
        assert activated.status == "active"

        with pytest.raises(ValueError, match="not a draft"):
            await store.update_property_key(session, pk.id, type="integer")


@pytest.mark.asyncio
class TestNodeTypeCRUD:
    async def test_create_node_type(self, session, store):
        schema = await store.create_graph_model(session, name="NT Test")
        await session.commit()
        version = await store.create_version(session, model_id=schema.id)
        await session.commit()

        # Create property keys first
        await store.create_property_key(session, version_id=version.id, name="name", type="string")
        await store.create_property_key(session, version_id=version.id, name="age", type="integer")
        await session.commit()

        nt = await store.create_node_type(
            session,
            version_id=version.id,
            name="Person",
            description="A person node",
            property_mappings=[
                {"property_key": "name"},
                {"property_key": "age"},
            ],
        )
        assert nt.id is not None
        assert nt.name == "Person"
        assert len(nt.property_mappings) == 2

    async def test_create_node_type_with_validation_rules(self, session, store):
        schema = await store.create_graph_model(session, name="Rules Test")
        await session.commit()
        version = await store.create_version(session, model_id=schema.id)
        await session.commit()

        await store.create_property_key(session, version_id=version.id, name="price", type="float")
        await store.create_property_key(
            session,
            version_id=version.id,
            name="status",
            type="string",
        )
        await session.commit()

        nt = await store.create_node_type(
            session,
            version_id=version.id,
            name="Product",
            property_mappings=[
                {
                    "property_key": "price",
                    "validation_rules": [
                        {"rule_type": "range", "params": {"min": 0, "max": 10000}},
                    ],
                },
                {
                    "property_key": "status",
                    "validation_rules": [
                        {"rule_type": "enum", "params": {"values": ["active", "inactive"]}},
                    ],
                },
            ],
        )
        assert nt.name == "Product"

    async def test_update_node_type(self, session, store):
        schema = await store.create_graph_model(session, name="NT Update")
        await session.commit()
        version = await store.create_version(session, model_id=schema.id)
        await session.commit()
        nt = await store.create_node_type(session, version_id=version.id, name="OldName")
        await session.commit()
        updated = await store.update_node_type(session, nt.id, name="NewName")
        assert updated.name == "NewName"

    async def test_update_node_type_replaces_property_mappings(self, session, store):
        schema = await store.create_graph_model(session, name="NT Props")
        await session.commit()
        version = await store.create_version(session, model_id=schema.id)
        await session.commit()
        await store.create_property_key(session, version_id=version.id, name="title", type="string")
        await store.create_property_key(session, version_id=version.id, name="count", type="integer")
        await session.commit()
        nt = await store.create_node_type(
            session,
            version_id=version.id,
            name="Doc",
            property_mappings=[{"property_key": "title"}],
        )
        await session.commit()
        assert len(nt.property_mappings) == 1

        # Full-replace: swap the single mapping for a different one.
        updated = await store.update_node_type(session, nt.id, property_mappings=[{"property_key": "count"}])
        assert len(updated.property_mappings) == 1
        assert updated.property_mappings[0].property_key.name == "count"

        # Empty list removes all properties.
        cleared = await store.update_node_type(session, nt.id, property_mappings=[])
        assert len(cleared.property_mappings) == 0

    async def test_delete_node_type(self, session, store):
        schema = await store.create_graph_model(session, name="NT Delete")
        await session.commit()
        version = await store.create_version(session, model_id=schema.id)
        await session.commit()
        nt = await store.create_node_type(session, version_id=version.id, name="Temp")
        await session.commit()
        result = await store.delete_node_type(session, nt.id)
        assert result is True

    async def test_cannot_modify_active_version(self, session, store):
        from invana.modeller.versioner import Versioner

        schema = await store.create_graph_model(session, name="Immutable Test")
        await session.commit()
        version = await store.create_version(session, model_id=schema.id)
        await session.commit()

        versioner = Versioner(store)
        activated = await versioner.activate(session, version_id=version.id)
        await session.commit()

        with pytest.raises(ValueError, match="not a draft"):
            await store.create_node_type(session, version_id=activated.id, name="Should Fail")


@pytest.mark.asyncio
class TestEdgeTypeCRUD:
    async def test_create_edge_type(self, session, store):
        schema = await store.create_graph_model(session, name="ET Test")
        await session.commit()
        version = await store.create_version(session, model_id=schema.id)
        await session.commit()

        await store.create_property_key(session, version_id=version.id, name="since", type="integer")
        await session.commit()

        et = await store.create_edge_type(
            session,
            version_id=version.id,
            name="KNOWS",
            source_node_types=["Person"],
            target_node_types=["Person"],
            property_mappings=[{"property_key": "since"}],
        )
        assert et.name == "KNOWS"
        assert et.source_node_types == ["Person"]
        assert len(et.property_mappings) == 1

    async def test_edge_multiplicity(self, session, store):
        schema = await store.create_graph_model(session, name="Multi Test")
        await session.commit()
        version = await store.create_version(session, model_id=schema.id)
        await session.commit()

        et = await store.create_edge_type(
            session,
            version_id=version.id,
            name="MANAGES",
            multiplicity="ONE2MANY",
        )
        assert et.multiplicity == "ONE2MANY"


@pytest.mark.asyncio
class TestConstraintCRUD:
    async def test_create_and_list_constraints(self, session, store):
        schema = await store.create_graph_model(session, name="Con Test")
        await session.commit()
        version = await store.create_version(session, model_id=schema.id)
        await session.commit()

        c = await store.create_constraint(
            session,
            version_id=version.id,
            name="unique_person_name",
            target_kind="node_type",
            target_label="Person",
            constraint_type="unique",
            properties=["name"],
        )
        assert c.name == "unique_person_name"
        assert c.constraint_type == "unique"
        await session.commit()

        constraints = await store.list_constraints(session, version.id)
        assert len(constraints) == 1

    async def test_delete_constraint(self, session, store):
        schema = await store.create_graph_model(session, name="Con Del")
        await session.commit()
        version = await store.create_version(session, model_id=schema.id)
        await session.commit()
        c = await store.create_constraint(
            session,
            version_id=version.id,
            name="temp_con",
            target_kind="node_type",
            target_label="Temp",
            constraint_type="exists",
            properties=["x"],
        )
        await session.commit()
        result = await store.delete_constraint(session, c.id)
        assert result is True


@pytest.mark.asyncio
class TestIndexCRUD:
    async def test_create_and_list_indexes(self, session, store):
        schema = await store.create_graph_model(session, name="Idx Test")
        await session.commit()
        version = await store.create_version(session, model_id=schema.id)
        await session.commit()

        idx = await store.create_index(
            session,
            version_id=version.id,
            name="idx_person_name",
            target_kind="node_type",
            target_label="Person",
            properties=["name"],
            index_type="range",
        )
        assert idx.name == "idx_person_name"
        await session.commit()

        indexes = await store.list_indexes(session, version.id)
        assert len(indexes) == 1

    async def test_delete_index(self, session, store):
        schema = await store.create_graph_model(session, name="Idx Del")
        await session.commit()
        version = await store.create_version(session, model_id=schema.id)
        await session.commit()
        idx = await store.create_index(
            session,
            version_id=version.id,
            name="temp_idx",
            target_kind="node_type",
            target_label="Temp",
            properties=["x"],
        )
        await session.commit()
        result = await store.delete_index(session, idx.id)
        assert result is True


@pytest.mark.asyncio
class TestCloneVersion:
    async def test_clone_version(self, session, store):
        from invana.modeller.versioner import Versioner

        schema = await store.create_graph_model(session, name="Clone Test")
        await session.commit()
        v1 = await store.create_version(session, model_id=schema.id)
        await session.commit()

        await store.create_property_key(session, version_id=v1.id, name="name", type="string")
        await session.commit()

        await store.create_node_type(
            session,
            version_id=v1.id,
            name="Person",
            property_mappings=[{"property_key": "name"}],
        )
        await store.create_edge_type(
            session,
            version_id=v1.id,
            name="KNOWS",
            source_node_types=["Person"],
            target_node_types=["Person"],
        )
        await store.create_constraint(
            session,
            version_id=v1.id,
            name="unique_person_name",
            target_kind="node_type",
            target_label="Person",
            constraint_type="unique",
            properties=["name"],
        )
        await store.create_index(
            session,
            version_id=v1.id,
            name="idx_person_name",
            target_kind="node_type",
            target_label="Person",
            properties=["name"],
        )
        await session.commit()

        # Activate v1
        versioner = Versioner(store)
        await versioner.activate(session, version_id=v1.id)
        await session.commit()

        # Clone into v2 draft
        v2 = await store.create_version(session, model_id=schema.id, based_on="1.0.0")
        await session.commit()

        v2_full = await store.get_version(session, v2.id)
        assert len(v2_full.property_keys) == 1
        assert v2_full.property_keys[0].name == "name"
        assert len(v2_full.node_types) == 1
        assert v2_full.node_types[0].name == "Person"
        assert len(v2_full.edge_types) == 1
        assert len(v2_full.constraints) == 1
        assert len(v2_full.indexes) == 1
