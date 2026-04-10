"""Integration tests for Neo4j-specific schema reader and writer querysets."""

import pytest
from invana.graph.connectors.base.data_types.schema_elements import ConstraintInfo, GraphSchemaSnapshot, IndexInfo


class TestSchemaReaderNodeLabels:
    async def test_get_node_labels(self, connector):
        await connector.data_writer.create_vertex("Person", {"name": "Alice"})
        await connector.data_writer.create_vertex("Company", {"name": "Acme"})
        labels = await connector.schema_reader.get_node_labels()
        assert "Person" in labels
        assert "Company" in labels

    async def test_get_node_labels_returns_list(self, connector):
        labels = await connector.schema_reader.get_node_labels()
        assert isinstance(labels, list)


class TestSchemaReaderEdgeLabels:
    async def test_get_edge_labels(self, connector):
        a = await connector.data_writer.create_vertex("Person", {"name": "A"})
        b = await connector.data_writer.create_vertex("Person", {"name": "B"})
        await connector.data_writer.create_edge("KNOWS", a.id, b.id)
        labels = await connector.schema_reader.get_edge_labels()
        assert "KNOWS" in labels

    async def test_get_edge_labels_returns_list(self, connector):
        labels = await connector.schema_reader.get_edge_labels()
        assert isinstance(labels, list)


class TestSchemaReaderPropertyKeys:
    async def test_get_property_keys(self, connector):
        await connector.data_writer.create_vertex("Person", {"name": "Alice", "age": 30, "city": "NYC"})
        keys = await connector.schema_reader.get_property_keys("Person")
        # The DB may contain Person nodes from earlier tests; check our keys are present
        assert {"name", "age", "city"}.issubset(set(keys))

    async def test_get_property_schema(self, connector):
        await connector.data_writer.create_vertex("Person", {"name": "Bob", "age": 25})
        props = await connector.schema_reader.get_property_schema("Person")
        prop_names = {p.name for p in props}
        assert {"name", "age"}.issubset(prop_names)
        age_prop = next(p for p in props if p.name == "age")
        assert age_prop.inferred_type == "integer"


class TestSchemaReaderIndexes:
    async def test_get_indexes_returns_index_info(self, connector):
        await connector.schema_writer.create_index("Person", ["name"], name="idx_person_name")
        indexes = await connector.schema_reader.get_indexes()
        idx = [i for i in indexes if i.name == "idx_person_name"]
        assert len(idx) == 1
        assert isinstance(idx[0], IndexInfo)
        assert idx[0].label == "Person"
        assert idx[0].properties == ["name"]
        assert idx[0].type == "btree"

    async def test_get_indexes_excludes_lookup(self, connector):
        indexes = await connector.schema_reader.get_indexes()
        assert all(i.type != "LOOKUP" for i in indexes)

    async def test_get_indexes_fulltext(self, connector):
        await connector.schema_writer.create_index(
            "Article", ["title", "body"], index_type="fulltext", name="ft_article"
        )
        indexes = await connector.schema_reader.get_indexes()
        ft = [i for i in indexes if i.name == "ft_article"]
        assert len(ft) == 1
        assert ft[0].type == "fulltext"
        assert set(ft[0].properties) == {"title", "body"}

    async def test_get_indexes_multiple(self, connector):
        await connector.schema_writer.create_index("Person", ["name"], name="idx_p_name")
        await connector.schema_writer.create_index("Person", ["age"], name="idx_p_age")
        indexes = await connector.schema_reader.get_indexes()
        names = {i.name for i in indexes}
        assert {"idx_p_name", "idx_p_age"}.issubset(names)


class TestSchemaReaderConstraints:
    async def test_get_constraints_unique(self, connector):
        await connector.schema_writer.create_constraint("User", ["email"], name="cst_user_email")
        constraints = await connector.schema_reader.get_constraints()
        cst = [c for c in constraints if c.name == "cst_user_email"]
        assert len(cst) == 1
        assert isinstance(cst[0], ConstraintInfo)
        assert cst[0].label == "User"
        assert cst[0].properties == ["email"]
        assert cst[0].type == "unique"


class TestSchemaReaderEdgeSchema:
    async def test_get_edge_schema(self, connector):
        a = await connector.data_writer.create_vertex("Person", {"name": "A"})
        b = await connector.data_writer.create_vertex("Person", {"name": "B"})
        await connector.data_writer.create_edge("KNOWS", a.id, b.id, {"since": 2020})
        schema = await connector.schema_reader.get_edge_schema("KNOWS")
        assert schema.name == "KNOWS"
        assert "Person" in schema.source_labels
        assert "Person" in schema.target_labels
        assert "since" in schema.property_keys


class TestSchemaWriterIndex:
    async def test_create_and_drop_index(self, connector):
        await connector.schema_writer.create_index("Person", ["name"], name="idx_to_drop")
        indexes = await connector.schema_reader.get_indexes()
        assert any(i.name == "idx_to_drop" for i in indexes)

        await connector.schema_writer.drop_index("idx_to_drop")
        indexes = await connector.schema_reader.get_indexes()
        assert not any(i.name == "idx_to_drop" for i in indexes)

    async def test_create_index_auto_name(self, connector):
        await connector.schema_writer.create_index("Person", ["age"])
        indexes = await connector.schema_reader.get_indexes()
        assert any(i.label == "Person" and "age" in i.properties for i in indexes)

    async def test_create_fulltext_index(self, connector):
        await connector.schema_writer.create_index("Doc", ["title", "content"], index_type="fulltext", name="ft_doc")
        indexes = await connector.schema_reader.get_indexes()
        ft = [i for i in indexes if i.name == "ft_doc"]
        assert len(ft) == 1
        assert ft[0].type == "fulltext"
        assert set(ft[0].properties) == {"title", "content"}

    async def test_create_index_idempotent(self, connector):
        """Creating the same index twice should not raise."""
        await connector.schema_writer.create_index("Person", ["name"], name="idx_idem")
        await connector.schema_writer.create_index("Person", ["name"], name="idx_idem")  # no-op
        indexes = await connector.schema_reader.get_indexes()
        assert sum(1 for i in indexes if i.name == "idx_idem") == 1

    async def test_drop_index_nonexistent_is_safe(self, connector):
        """Dropping a non-existent index should not raise."""
        await connector.schema_writer.drop_index("idx_does_not_exist")


class TestSchemaWriterConstraint:
    async def test_create_and_drop_constraint(self, connector):
        await connector.schema_writer.create_constraint("User", ["username"], name="cst_to_drop")
        constraints = await connector.schema_reader.get_constraints()
        assert any(c.name == "cst_to_drop" for c in constraints)

        await connector.schema_writer.drop_constraint("cst_to_drop")
        constraints = await connector.schema_reader.get_constraints()
        assert not any(c.name == "cst_to_drop" for c in constraints)

    async def test_create_unique_constraint(self, connector):
        await connector.schema_writer.create_constraint(
            "Product", ["sku"], constraint_type="unique", name="cst_product_sku"
        )
        constraints = await connector.schema_reader.get_constraints()
        cst = [c for c in constraints if c.name == "cst_product_sku"]
        assert len(cst) == 1
        assert cst[0].type == "unique"

    async def test_drop_constraint_nonexistent_is_safe(self, connector):
        """Dropping a non-existent constraint should not raise."""
        await connector.schema_writer.drop_constraint("cst_does_not_exist")

    @pytest.mark.skip(reason="Property existence constraints require Neo4j Enterprise Edition")
    async def test_create_exists_constraint(self, connector):
        await connector.schema_writer.create_constraint(
            "Employee", ["emp_id"], constraint_type="exists", name="cst_emp_id_exists"
        )
        constraints = await connector.schema_reader.get_constraints()
        cst = [c for c in constraints if c.name == "cst_emp_id_exists"]
        assert len(cst) == 1
        assert cst[0].type == "exists"


class TestSchemaReaderFullSchema:
    async def test_get_full_schema_returns_snapshot(self, connector):
        await connector.data_writer.create_vertex("Person", {"name": "Alice", "age": 30})
        a = await connector.data_writer.create_vertex("Person", {"name": "Bob", "age": 25})
        b = await connector.data_writer.create_vertex("Company", {"name": "Acme"})
        await connector.data_writer.create_edge("WORKS_AT", a.id, b.id, {"since": 2022})
        # Use different labels/properties so index and constraint don't conflict
        await connector.schema_writer.create_index("Company", ["name"], name="idx_fs_company_name")
        await connector.schema_writer.create_constraint("User", ["email"], name="cst_fs_user_email")

        snapshot = await connector.schema_reader.get_full_schema()

        assert isinstance(snapshot, GraphSchemaSnapshot)
        assert "Person" in snapshot.node_labels
        assert "Company" in snapshot.node_labels
        assert "WORKS_AT" in snapshot.edge_labels

        # node_schemas contains inferred PropertyInfo per label
        assert "Person" in snapshot.node_schemas
        person_keys = {p.name for p in snapshot.node_schemas["Person"]}
        assert {"name", "age"}.issubset(person_keys)

        # edge_schemas contains EdgeSchemaInfo per relationship type
        assert "WORKS_AT" in snapshot.edge_schemas
        works_at = snapshot.edge_schemas["WORKS_AT"]
        assert "Person" in works_at.source_labels
        assert "Company" in works_at.target_labels

        # indexes and constraints from Neo4j-specific reader
        assert any(i.name == "idx_fs_company_name" for i in snapshot.indexes)
        assert any(c.name == "cst_fs_user_email" for c in snapshot.constraints)

    async def test_get_full_schema_empty_db_returns_snapshot(self, connector):
        """get_full_schema() on a DB with no test data still returns a valid snapshot."""
        snapshot = await connector.schema_reader.get_full_schema()
        assert isinstance(snapshot, GraphSchemaSnapshot)
        assert isinstance(snapshot.node_labels, list)
        assert isinstance(snapshot.edge_labels, list)
        assert isinstance(snapshot.indexes, list)
        assert isinstance(snapshot.constraints, list)
