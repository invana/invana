"""Tests for the SchemaValidator."""

import pytest

from invana.modeller.validator import SchemaValidator
from invana.modeller.versioner import Versioner


@pytest.mark.asyncio
class TestSchemaValidator:
    async def _setup_schema(self, session, store):
        """Create a schema with Person, Employee (child), and KNOWS edge."""
        schema = await store.create_schema(session, name="Validate Test")
        await session.commit()
        version = await store.create_version(session, schema_id=schema.id)
        await session.commit()

        await store.create_node_type(
            session,
            version_id=version.id,
            name="Person",
            properties=[
                {"name": "name", "type": "string", "required": True},
                {"name": "age", "type": "integer"},
                {
                    "name": "email",
                    "type": "string",
                    "validation_rules": [
                        {"rule_type": "pattern", "params": {"pattern": r"^[\w.+-]+@[\w-]+\.[\w.]+$"}},
                    ],
                },
            ],
        )
        await store.create_node_type(
            session,
            version_id=version.id,
            name="Employee",
            parent_type="Person",
            properties=[
                {"name": "department", "type": "string", "required": True},
            ],
        )
        await store.create_node_type(
            session,
            version_id=version.id,
            name="AbstractBase",
            is_abstract=True,
        )
        await store.create_edge_type(
            session,
            version_id=version.id,
            name="KNOWS",
            source_node_types=["Person"],
            target_node_types=["Person"],
            properties=[{"name": "since", "type": "integer"}],
        )
        await session.commit()

        versioner = Versioner(store)
        activated = await versioner.activate(session, version_id=version.id)
        await session.commit()

        # Reload fully
        return await store.get_version(session, activated.id)

    async def test_valid_vertex_create(self, session, store):
        version = await self._setup_schema(session, store)
        validator = SchemaValidator()
        validator.load(version)

        errors = validator.validate_vertex_create("Person", {"name": "Alice", "age": 30})
        assert errors == []

    async def test_missing_required_property(self, session, store):
        version = await self._setup_schema(session, store)
        validator = SchemaValidator()
        validator.load(version)

        errors = validator.validate_vertex_create("Person", {"age": 30})
        assert len(errors) == 1
        assert errors[0].code == "missing_required"
        assert errors[0].field == "name"

    async def test_unknown_label(self, session, store):
        version = await self._setup_schema(session, store)
        validator = SchemaValidator()
        validator.load(version)

        errors = validator.validate_vertex_create("UnknownType", {"name": "X"})
        assert len(errors) == 1
        assert errors[0].code == "unknown_label"

    async def test_abstract_type(self, session, store):
        version = await self._setup_schema(session, store)
        validator = SchemaValidator()
        validator.load(version)

        errors = validator.validate_vertex_create("AbstractBase", {})
        assert len(errors) == 1
        assert errors[0].code == "abstract_type"

    async def test_type_mismatch(self, session, store):
        version = await self._setup_schema(session, store)
        validator = SchemaValidator()
        validator.load(version)

        errors = validator.validate_vertex_create("Person", {"name": "Alice", "age": "thirty"})
        assert any(e.code == "type_mismatch" for e in errors)

    async def test_pattern_validation(self, session, store):
        version = await self._setup_schema(session, store)
        validator = SchemaValidator()
        validator.load(version)

        errors = validator.validate_vertex_create("Person", {"name": "Alice", "email": "not-an-email"})
        assert any(e.code == "pattern_violation" for e in errors)

    async def test_valid_pattern(self, session, store):
        version = await self._setup_schema(session, store)
        validator = SchemaValidator()
        validator.load(version)

        errors = validator.validate_vertex_create("Person", {"name": "Alice", "email": "alice@example.com"})
        assert errors == []

    async def test_unknown_property_strict(self, session, store):
        version = await self._setup_schema(session, store)
        validator = SchemaValidator()
        validator.load(version, "strict")

        errors = validator.validate_vertex_create("Person", {"name": "Alice", "unknown_prop": "val"})
        assert any(e.code == "unknown_property" for e in errors)

    async def test_unknown_property_permissive(self, session, store):
        version = await self._setup_schema(session, store)
        validator = SchemaValidator()
        validator.load(version, "permissive")

        errors = validator.validate_vertex_create("Person", {"name": "Alice", "unknown_prop": "val"})
        assert not any(e.code == "unknown_property" for e in errors)

    async def test_inherited_properties_validated(self, session, store):
        """Employee inherits 'name' (required) from Person."""
        version = await self._setup_schema(session, store)
        validator = SchemaValidator()
        validator.load(version)

        # Missing both 'name' (inherited) and 'department' (own)
        errors = validator.validate_vertex_create("Employee", {})
        required_fields = {e.field for e in errors if e.code == "missing_required"}
        assert "name" in required_fields
        assert "department" in required_fields

    async def test_vertex_update_no_required_check(self, session, store):
        version = await self._setup_schema(session, store)
        validator = SchemaValidator()
        validator.load(version)

        # Update doesn't check required — only validates provided values
        errors = validator.validate_vertex_update("Person", {"age": 25})
        assert errors == []

    async def test_edge_create_valid(self, session, store):
        version = await self._setup_schema(session, store)
        validator = SchemaValidator()
        validator.load(version)

        errors = validator.validate_edge_create("KNOWS", "Person", "Person", {"since": 2020})
        assert errors == []

    async def test_edge_create_invalid_source(self, session, store):
        version = await self._setup_schema(session, store)
        validator = SchemaValidator()
        validator.load(version)

        errors = validator.validate_edge_create("KNOWS", "AbstractBase", "Person", {"since": 2020})
        assert any(e.code == "invalid_source_type" for e in errors)

    async def test_edge_create_allows_subtypes(self, session, store):
        """Employee is a subtype of Person, so it should be allowed as a source."""
        version = await self._setup_schema(session, store)
        validator = SchemaValidator()
        validator.load(version)

        errors = validator.validate_edge_create("KNOWS", "Employee", "Person", {"since": 2020})
        assert not any(e.code == "invalid_source_type" for e in errors)

    async def test_no_schema_loaded(self):
        validator = SchemaValidator()
        errors = validator.validate_vertex_create("Person", {"name": "Alice"})
        assert errors == []  # No schema loaded — skip validation
