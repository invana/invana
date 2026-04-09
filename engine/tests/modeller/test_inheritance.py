"""Tests for the inheritance resolver."""

import pytest

from invana.modeller.inheritance import (
    InheritanceCycleError,
    build_hierarchy,
    build_type_map,
    get_subtypes,
    resolve_effective_mappings,
)


@pytest.mark.asyncio
class TestInheritance:
    async def _create_types(self, session, store):
        """Helper — create a schema with an inheritance chain: Entity → Person → Employee."""
        schema = await store.create_schema(session, name="Inherit")
        await session.commit()
        version = await store.create_version(session, schema_id=schema.id)
        await session.commit()

        await store.create_property_key(session, version_id=version.id, name="id", type="string")
        await store.create_property_key(session, version_id=version.id, name="name", type="string")
        await store.create_property_key(session, version_id=version.id, name="department", type="string")
        await session.commit()

        await store.create_node_type(
            session,
            version_id=version.id,
            name="Entity",
            property_mappings=[{"property_key": "id"}],
        )
        await store.create_node_type(
            session,
            version_id=version.id,
            name="Person",
            parent_type="Entity",
            property_mappings=[{"property_key": "name"}],
        )
        await store.create_node_type(
            session,
            version_id=version.id,
            name="Employee",
            parent_type="Person",
            property_mappings=[{"property_key": "department"}],
        )
        await session.commit()
        return version.id

    async def test_build_hierarchy(self, session, store):
        version_id = await self._create_types(session, store)
        node_types = await store.list_node_types(session, version_id)
        type_map = build_type_map(node_types)

        chain = build_hierarchy(type_map["Employee"], type_map)
        assert chain == ["Entity", "Person", "Employee"]

    async def test_resolve_effective_mappings(self, session, store):
        version_id = await self._create_types(session, store)
        node_types = await store.list_node_types(session, version_id)
        type_map = build_type_map(node_types)

        effective = resolve_effective_mappings(type_map["Employee"], type_map)
        names = [m.property_key.name for m in effective]
        assert "id" in names
        assert "name" in names
        assert "department" in names
        assert len(effective) == 3

    async def test_get_subtypes(self, session, store):
        version_id = await self._create_types(session, store)
        node_types = await store.list_node_types(session, version_id)
        type_map = build_type_map(node_types)

        subs = get_subtypes("Entity", type_map)
        assert subs == {"Person", "Employee"}

        subs_person = get_subtypes("Person", type_map)
        assert subs_person == {"Employee"}

    async def test_cycle_detection(self, session, store):
        schema = await store.create_schema(session, name="Cycle")
        await session.commit()
        version = await store.create_version(session, schema_id=schema.id)
        await session.commit()

        await store.create_node_type(
            session,
            version_id=version.id,
            name="A",
            parent_type="B",
        )
        await store.create_node_type(
            session,
            version_id=version.id,
            name="B",
            parent_type="A",
        )
        await session.commit()

        node_types = await store.list_node_types(session, version.id)
        type_map = build_type_map(node_types)

        with pytest.raises(InheritanceCycleError):
            build_hierarchy(type_map["A"], type_map)
