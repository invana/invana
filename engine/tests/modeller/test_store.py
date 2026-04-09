"""Tests for SchemaStore CRUD operations."""

import pytest


@pytest.mark.asyncio
class TestSchemaCRUD:
    async def test_create_schema(self, session, store):
        schema = await store.create_schema(session, name="Test Schema", description="A test")
        assert schema.id is not None
        assert schema.name == "Test Schema"
        assert schema.description == "A test"
        assert schema.validation_mode == "strict"

    async def test_get_schema(self, session, store):
        schema = await store.create_schema(session, name="Get Test")
        await session.commit()
        fetched = await store.get_schema(session, schema.id)
        assert fetched is not None
        assert fetched.name == "Get Test"

    async def test_list_schemas(self, session, store):
        await store.create_schema(session, name="Schema A")
        await store.create_schema(session, name="Schema B")
        await session.commit()
        schemas = await store.list_schemas(session)
        assert len(schemas) >= 2
        names = [s.name for s in schemas]
        assert "Schema A" in names
        assert "Schema B" in names

    async def test_update_schema(self, session, store):
        schema = await store.create_schema(session, name="Before")
        await session.commit()
        updated = await store.update_schema(session, schema.id, name="After")
        assert updated is not None
        assert updated.name == "After"

    async def test_delete_schema(self, session, store):
        schema = await store.create_schema(session, name="Delete Me")
        await session.commit()
        result = await store.delete_schema(session, schema.id)
        assert result is True
        await session.commit()
        fetched = await store.get_schema(session, schema.id)
        assert fetched is None

    async def test_delete_nonexistent_schema(self, session, store):
        result = await store.delete_schema(session, "nonexistent-id")
        assert result is False


@pytest.mark.asyncio
class TestVersionCRUD:
    async def test_create_version(self, session, store):
        schema = await store.create_schema(session, name="V Test")
        await session.commit()
        version = await store.create_version(session, schema_id=schema.id)
        assert version.id is not None
        assert version.status == "draft"
        assert version.version is None

    async def test_only_one_draft(self, session, store):
        schema = await store.create_schema(session, name="Draft Test")
        await session.commit()
        await store.create_version(session, schema_id=schema.id)
        with pytest.raises(ValueError, match="draft version already exists"):
            await store.create_version(session, schema_id=schema.id)

    async def test_get_version(self, session, store):
        schema = await store.create_schema(session, name="V Get")
        await session.commit()
        version = await store.create_version(session, schema_id=schema.id)
        await session.commit()
        fetched = await store.get_version(session, version.id)
        assert fetched is not None
        assert fetched.id == version.id

    async def test_list_versions(self, session, store):
        schema = await store.create_schema(session, name="V List")
        await session.commit()
        await store.create_version(session, schema_id=schema.id)
        await session.commit()
        versions = await store.list_versions(session, schema.id)
        assert len(versions) == 1


@pytest.mark.asyncio
class TestNodeTypeCRUD:
    async def test_create_node_type(self, session, store):
        schema = await store.create_schema(session, name="NT Test")
        await session.commit()
        version = await store.create_version(session, schema_id=schema.id)
        await session.commit()

        nt = await store.create_node_type(
            session,
            version_id=version.id,
            name="Person",
            description="A person node",
            properties=[
                {"name": "name", "type": "string", "required": True},
                {"name": "age", "type": "integer"},
            ],
        )
        assert nt.id is not None
        assert nt.name == "Person"
        assert len(nt.properties) == 2

    async def test_create_node_type_with_validation_rules(self, session, store):
        schema = await store.create_schema(session, name="Rules Test")
        await session.commit()
        version = await store.create_version(session, schema_id=schema.id)
        await session.commit()

        nt = await store.create_node_type(
            session,
            version_id=version.id,
            name="Product",
            properties=[
                {
                    "name": "price",
                    "type": "float",
                    "validation_rules": [
                        {"rule_type": "range", "params": {"min": 0, "max": 10000}},
                    ],
                },
                {
                    "name": "status",
                    "type": "string",
                    "validation_rules": [
                        {"rule_type": "enum", "params": {"values": ["active", "inactive"]}},
                    ],
                },
            ],
        )
        assert nt.name == "Product"

    async def test_update_node_type(self, session, store):
        schema = await store.create_schema(session, name="NT Update")
        await session.commit()
        version = await store.create_version(session, schema_id=schema.id)
        await session.commit()
        nt = await store.create_node_type(session, version_id=version.id, name="OldName")
        await session.commit()
        updated = await store.update_node_type(session, nt.id, name="NewName")
        assert updated.name == "NewName"

    async def test_delete_node_type(self, session, store):
        schema = await store.create_schema(session, name="NT Delete")
        await session.commit()
        version = await store.create_version(session, schema_id=schema.id)
        await session.commit()
        nt = await store.create_node_type(session, version_id=version.id, name="Temp")
        await session.commit()
        result = await store.delete_node_type(session, nt.id)
        assert result is True

    async def test_cannot_modify_active_version(self, session, store):
        from invana.modeller.versioner import Versioner

        schema = await store.create_schema(session, name="Immutable Test")
        await session.commit()
        version = await store.create_version(session, schema_id=schema.id)
        await session.commit()

        versioner = Versioner(store)
        activated = await versioner.activate(session, version_id=version.id)
        await session.commit()

        with pytest.raises(ValueError, match="not a draft"):
            await store.create_node_type(session, version_id=activated.id, name="Should Fail")


@pytest.mark.asyncio
class TestEdgeTypeCRUD:
    async def test_create_edge_type(self, session, store):
        schema = await store.create_schema(session, name="ET Test")
        await session.commit()
        version = await store.create_version(session, schema_id=schema.id)
        await session.commit()

        et = await store.create_edge_type(
            session,
            version_id=version.id,
            name="KNOWS",
            source_node_types=["Person"],
            target_node_types=["Person"],
            properties=[{"name": "since", "type": "integer"}],
        )
        assert et.name == "KNOWS"
        assert et.source_node_types == ["Person"]
        assert len(et.properties) == 1

    async def test_edge_multiplicity(self, session, store):
        schema = await store.create_schema(session, name="Multi Test")
        await session.commit()
        version = await store.create_version(session, schema_id=schema.id)
        await session.commit()

        et = await store.create_edge_type(
            session,
            version_id=version.id,
            name="MANAGES",
            multiplicity="ONE2MANY",
        )
        assert et.multiplicity == "ONE2MANY"


@pytest.mark.asyncio
class TestIndexCRUD:
    async def test_create_and_list_indexes(self, session, store):
        schema = await store.create_schema(session, name="Idx Test")
        await session.commit()
        version = await store.create_version(session, schema_id=schema.id)
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
        schema = await store.create_schema(session, name="Idx Del")
        await session.commit()
        version = await store.create_version(session, schema_id=schema.id)
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

        schema = await store.create_schema(session, name="Clone Test")
        await session.commit()
        v1 = await store.create_version(session, schema_id=schema.id)
        await session.commit()

        await store.create_node_type(
            session,
            version_id=v1.id,
            name="Person",
            properties=[{"name": "name", "type": "string", "required": True}],
        )
        await store.create_edge_type(
            session,
            version_id=v1.id,
            name="KNOWS",
            source_node_types=["Person"],
            target_node_types=["Person"],
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
        v2 = await store.create_version(session, schema_id=schema.id, based_on="1.0.0")
        await session.commit()

        v2_full = await store.get_version(session, v2.id)
        assert len(v2_full.node_types) == 1
        assert v2_full.node_types[0].name == "Person"
        assert len(v2_full.edge_types) == 1
        assert len(v2_full.indexes) == 1
