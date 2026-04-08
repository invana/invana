"""Integration tests for Neo4j-specific schema reader and writer querysets."""

import pytest
from invana.graph.connectors.base.data_types.schema_elements import ConstraintInfo, IndexInfo


class TestSchemaReaderNodeLabels:
    async def test_get_node_labels(self, connector):
        await connector.data_writer.create_vertex("Person", {"name": "Alice"})
        await connector.data_writer.create_vertex("Company", {"name": "Acme"})
        labels = await connector.schema_reader.get_node_labels()
        assert "Person" in labels
        assert "Company" in labels

    async def test_get_node_labels_empty(self, connector):
        labels = await connector.schema_reader.get_node_labels()
        assert labels == []


class TestSchemaReaderEdgeLabels:
    async def test_get_edge_labels(self, connector):
        a = await connector.data_writer.create_vertex("Person", {"name": "A"})
        b = await connector.data_writer.create_vertex("Person", {"name": "B"})
        await connector.data_writer.create_edge("KNOWS", a.id, b.id)
        labels = await connector.schema_reader.get_edge_labels()
        assert "KNOWS" in labels

    async def test_get_edge_labels_empty(self, connector):
        labels = await connector.schema_reader.get_edge_labels()
        assert labels == []


class TestSchemaReaderPropertyKeys:
    async def test_get_property_keys(self, connector):
        await connector.data_writer.create_vertex("Person", {"name": "Alice", "age": 30, "city": "NYC"})
        keys = await connector.schema_reader.get_property_keys("Person")
        assert set(keys) == {"name", "age", "city"}


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
        assert ft[0].properties == ["title", "body"]

    async def test_get_indexes_multiple(self, connector):
        await connector.schema_writer.create_index("Person", ["name"], name="idx_p_name")
        await connector.schema_writer.create_index("Person", ["age"], name="idx_p_age")
        indexes = await connector.schema_reader.get_indexes()
        names = {i.name for i in indexes}
        assert "idx_p_name" in names
        assert "idx_p_age" in names


class TestSchemaReaderConstraints:
    async def test_get_constraints_unique(self, connector):
        await connector.data_writer.create_vertex("User", {"email": "test@test.com"})
        await connector.schema_writer.create_constraint("User", ["email"], name="cst_user_email")
        constraints = await connector.schema_reader.get_constraints()
        cst = [c for c in constraints if c.name == "cst_user_email"]
        assert len(cst) == 1
        assert isinstance(cst[0], ConstraintInfo)
        assert cst[0].label == "User"
        assert cst[0].properties == ["email"]
        assert cst[0].type == "unique"


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


class TestSchemaWriterConstraint:
    async def test_create_and_drop_constraint(self, connector):
        await connector.data_writer.create_vertex("User", {"username": "test"})
        await connector.schema_writer.create_constraint("User", ["username"], name="cst_to_drop")
        constraints = await connector.schema_reader.get_constraints()
        assert any(c.name == "cst_to_drop" for c in constraints)

        await connector.schema_writer.drop_constraint("cst_to_drop")
        constraints = await connector.schema_reader.get_constraints()
        assert not any(c.name == "cst_to_drop" for c in constraints)

    async def test_create_unique_constraint(self, connector):
        await connector.data_writer.create_vertex("Product", {"sku": "ABC123"})
        await connector.schema_writer.create_constraint(
            "Product", ["sku"], constraint_type="unique", name="cst_product_sku"
        )
        constraints = await connector.schema_reader.get_constraints()
        cst = [c for c in constraints if c.name == "cst_product_sku"]
        assert len(cst) == 1
        assert cst[0].type == "unique"

    @pytest.mark.skip(reason="Property existence constraints require Neo4j Enterprise Edition")
    async def test_create_exists_constraint(self, connector):
        await connector.data_writer.create_vertex("Employee", {"emp_id": "E001"})
        await connector.schema_writer.create_constraint(
            "Employee", ["emp_id"], constraint_type="exists", name="cst_emp_id_exists"
        )
        constraints = await connector.schema_reader.get_constraints()
        cst = [c for c in constraints if c.name == "cst_emp_id_exists"]
        assert len(cst) == 1
        assert cst[0].type == "exists"
