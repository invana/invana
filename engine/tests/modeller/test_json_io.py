"""Tests for JSON export/import."""

import pytest

from invana.modeller.json_io import SchemaExporter, SchemaImporter
from invana.modeller.schemas import SchemaExport
from invana.modeller.versioner import Versioner


@pytest.mark.asyncio
class TestJsonExportImport:
    async def _create_full_schema(self, session, store):
        """Create a schema with property keys, node types, edge types, constraints, indexes, and activate it."""
        schema = await store.create_graph_model(
            session,
            name="Export Test",
            description="Test schema",
        )
        await session.commit()
        version = await store.create_version(session, model_id=schema.id)
        await session.commit()

        # Global property keys
        await store.create_property_key(session, version_id=version.id, name="name", type="string")
        await store.create_property_key(session, version_id=version.id, name="age", type="integer")
        await store.create_property_key(session, version_id=version.id, name="email", type="string")
        await store.create_property_key(session, version_id=version.id, name="since", type="integer")
        await session.commit()

        await store.create_node_type(
            session,
            version_id=version.id,
            name="Person",
            description="A person",
            property_mappings=[
                {"property_key": "name"},
                {"property_key": "age"},
                {
                    "property_key": "email",
                    "validation_rules": [
                        {"rule_type": "pattern", "params": {"pattern": "^.+@.+$"}},
                    ],
                },
            ],
        )
        await store.create_edge_type(
            session,
            version_id=version.id,
            name="KNOWS",
            source_node_types=["Person"],
            target_node_types=["Person"],
            multiplicity="MULTI",
            property_mappings=[{"property_key": "since"}],
        )
        await store.create_constraint(
            session,
            version_id=version.id,
            name="person_name_unique",
            target_kind="node_type",
            target_label="Person",
            constraint_type="unique",
            properties=["name"],
        )
        await store.create_constraint(
            session,
            version_id=version.id,
            name="person_name_exists",
            target_kind="node_type",
            target_label="Person",
            constraint_type="exists",
            properties=["name"],
        )
        await store.create_index(
            session,
            version_id=version.id,
            name="idx_person_name",
            target_kind="node_type",
            target_label="Person",
            properties=["name"],
        )
        await session.commit()

        versioner = Versioner(store)
        activated = await versioner.activate(session, version_id=version.id)
        await session.commit()

        return schema, await store.get_version(session, activated.id)

    async def test_export(self, session, store):
        schema, version = await self._create_full_schema(session, store)
        export = SchemaExporter.export(version, schema.name, schema.description)

        assert export.schema_name == "Export Test"
        assert len(export.property_keys) == 4
        assert len(export.node_types) == 1
        assert export.node_types[0].name == "Person"
        assert len(export.node_types[0].property_mappings) == 3
        assert len(export.edge_types) == 1
        assert len(export.constraints) == 2
        assert len(export.indexes) == 1

    async def test_export_json_round_trip(self, session, store):
        schema, version = await self._create_full_schema(session, store)
        export = SchemaExporter.export(version, schema.name, schema.description)

        # Serialise to JSON and back
        json_str = export.model_dump_json()
        parsed = SchemaExport.model_validate_json(json_str)
        assert parsed.schema_name == export.schema_name
        assert len(parsed.node_types) == len(export.node_types)
        assert len(parsed.property_keys) == len(export.property_keys)
        assert len(parsed.constraints) == len(export.constraints)

    async def test_import(self, session, store):
        schema, version = await self._create_full_schema(session, store)
        export = SchemaExporter.export(version, schema.name, schema.description)

        # Import into a new schema
        new_schema = await store.create_graph_model(session, name="Imported")
        await session.commit()

        importer = SchemaImporter(store)
        new_version_id = await importer.import_schema(
            session,
            model_id=new_schema.id,
            data=export,
        )
        await session.commit()

        new_version = await store.get_version(session, new_version_id)
        assert new_version is not None
        assert new_version.status == "draft"
        assert len(new_version.property_keys) == 4
        assert len(new_version.node_types) == 1
        assert new_version.node_types[0].name == "Person"
        assert len(new_version.edge_types) == 1
        assert len(new_version.constraints) == 2
        assert len(new_version.indexes) == 1

    async def test_import_preserves_validation_rules(self, session, store):
        schema, version = await self._create_full_schema(session, store)
        export = SchemaExporter.export(version, schema.name, schema.description)

        new_schema = await store.create_graph_model(session, name="Rules Import")
        await session.commit()

        importer = SchemaImporter(store)
        new_version_id = await importer.import_schema(
            session,
            model_id=new_schema.id,
            data=export,
        )
        await session.commit()

        new_version = await store.get_version(session, new_version_id)
        person_type = new_version.node_types[0]
        email_mapping = next(m for m in person_type.property_mappings if m.property_key.name == "email")
        assert len(email_mapping.validation_rules) == 1
        assert email_mapping.validation_rules[0].rule_type == "pattern"
