"""Unit tests for the CSV loader — no database required.

All connector interactions are mocked via ``unittest.mock.AsyncMock``.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from invana.graph.loaders.csv import (
    CSVLoader,
    LoaderConfig,
    LoaderStats,
    _chunk,
    _coerce_value,
    _merge_stats,
    _parse_column_name,
    _parse_edge_row,
    _parse_node_row,
)
from invana.graph.types.data_elements import Edge, Vertex

FIXTURES = Path(__file__).parent / "fixtures"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_connector(
    vertex_factory=None,
    edge_factory=None,
) -> MagicMock:
    """Return a minimal mock connector with async bulk methods."""
    connector = MagicMock()
    connector.bulk = MagicMock()

    # Default: return one Vertex per record with _csv_source_id echoed back
    if vertex_factory is None:

        async def _default_vertices(label, records):
            return [Vertex(id=f"db-{i}", label=label, properties=dict(r)) for i, r in enumerate(records)]

        vertex_factory = _default_vertices

    if edge_factory is None:

        async def _default_edges(label, records):
            return [
                Edge(
                    id=f"e-{i}",
                    label=label,
                    source=r["source_id"],
                    target=r["target_id"],
                    properties=r.get("properties", {}),
                )
                for i, r in enumerate(records)
            ]

        edge_factory = _default_edges

    connector.bulk.bulk_create_vertices = vertex_factory
    connector.bulk.bulk_create_edges = edge_factory
    return connector


# ---------------------------------------------------------------------------
# _parse_column_name
# ---------------------------------------------------------------------------


class TestParseColumnName:
    def test_typed_string(self):
        assert _parse_column_name("Properties:code_string") == ("code", "string")

    def test_typed_int(self):
        assert _parse_column_name("Properties:runways_int") == ("runways", "int")

    def test_typed_long(self):
        assert _parse_column_name("Properties:count_long") == ("count", "long")

    def test_typed_double(self):
        assert _parse_column_name("Properties:lat_double") == ("lat", "double")

    def test_typed_float(self):
        assert _parse_column_name("Properties:weight_float") == ("weight", "float")

    def test_typed_bool(self):
        assert _parse_column_name("Properties:active_bool") == ("active", "bool")

    def test_untyped(self):
        assert _parse_column_name("Properties:title") == ("title", None)

    def test_property_name_with_underscore_not_suffix(self):
        # "first_name" — "name" is not a known suffix
        assert _parse_column_name("Properties:first_name") == ("first_name", None)

    def test_property_name_underscore_then_known_suffix(self):
        # "born_year_int" — suffix "int" is known; name is "born_year"
        assert _parse_column_name("Properties:born_year_int") == ("born_year", "int")


# ---------------------------------------------------------------------------
# _coerce_value
# ---------------------------------------------------------------------------


class TestCoerceValue:
    # Explicit type hints
    def test_string(self):
        assert _coerce_value("hello", "string") == "hello"

    def test_int(self):
        assert _coerce_value("42", "int") == 42

    def test_int_from_float_string(self):
        assert _coerce_value("5.0", "int") == 5

    def test_long(self):
        assert _coerce_value("100", "long") == 100

    def test_double(self):
        assert _coerce_value("3.14", "double") == pytest.approx(3.14)

    def test_float(self):
        assert _coerce_value("2.71", "float") == pytest.approx(2.71)

    def test_bool_true_variants(self):
        for val in ("true", "True", "TRUE", "1", "yes"):
            assert _coerce_value(val, "bool") is True

    def test_bool_false_variants(self):
        for val in ("false", "False", "0", "no", "anything"):
            assert _coerce_value(val, "bool") is False

    # Auto-inference (no type hint)
    def test_auto_int(self):
        assert _coerce_value("1999", None) == 1999
        assert isinstance(_coerce_value("1999", None), int)

    def test_auto_float(self):
        assert _coerce_value("3.14", None) == pytest.approx(3.14)
        assert isinstance(_coerce_value("3.14", None), float)

    def test_auto_bool_true(self):
        assert _coerce_value("true", None) is True

    def test_auto_bool_false(self):
        assert _coerce_value("false", None) is False

    def test_auto_string(self):
        assert _coerce_value("Atlanta", None) == "Atlanta"

    # Empty values
    def test_empty_string_returns_none(self):
        assert _coerce_value("", None) is None

    def test_blank_string_returns_none(self):
        assert _coerce_value("   ", None) is None

    def test_none_returns_none(self):
        assert _coerce_value(None, None) is None


# ---------------------------------------------------------------------------
# _parse_node_row / _parse_edge_row
# ---------------------------------------------------------------------------


class TestParseNodeRow:
    def test_basic(self):
        row = {
            "Id": "1",
            "Label": "Airport",
            "Properties:code_string": "ATL",
            "Properties:runways_int": "5",
            "Properties:lat_double": "33.636",
        }
        result = _parse_node_row(row, None)
        assert result["id"] == "1"
        assert result["label"] == "Airport"
        assert result["properties"] == {"code": "ATL", "runways": 5, "lat": pytest.approx(33.636)}

    def test_label_override(self):
        row = {"Id": "X", "Label": "Original", "Properties:name": "Alice"}
        result = _parse_node_row(row, "Person")
        assert result["label"] == "Person"

    def test_empty_property_omitted(self):
        row = {"Id": "1", "Label": "Node", "Properties:name": "", "Properties:age_int": "30"}
        result = _parse_node_row(row, None)
        assert "name" not in result["properties"]
        assert result["properties"]["age"] == 30

    def test_non_property_columns_ignored(self):
        row = {"Id": "1", "Label": "Node", "SomeOther": "ignored", "Properties:x_int": "7"}
        result = _parse_node_row(row, None)
        assert "SomeOther" not in result["properties"]
        assert result["properties"]["x"] == 7


class TestParseEdgeRow:
    def test_basic_fromid_toid(self):
        row = {
            "Id": "R1",
            "Label": "ACTED_IN",
            "FromId": "PERSON_1",
            "ToId": "MOVIE_1",
            "Properties:roles": "Neo",
        }
        result = _parse_edge_row(row, None)
        assert result["id"] == "R1"
        assert result["label"] == "ACTED_IN"
        assert result["from_id"] == "PERSON_1"
        assert result["to_id"] == "MOVIE_1"
        assert result["properties"] == {"roles": "Neo"}

    def test_sourceid_targetid_aliases(self):
        row = {
            "Id": "R2",
            "Label": "KNOWS",
            "SourceId": "A",
            "TargetId": "B",
        }
        result = _parse_edge_row(row, None)
        assert result["from_id"] == "A"
        assert result["to_id"] == "B"

    def test_label_override(self):
        row = {"Id": "R3", "Label": "OLD", "FromId": "A", "ToId": "B"}
        result = _parse_edge_row(row, "NEW_LABEL")
        assert result["label"] == "NEW_LABEL"


# ---------------------------------------------------------------------------
# _chunk
# ---------------------------------------------------------------------------


class TestChunk:
    def test_even_split(self):
        chunks = list(_chunk([1, 2, 3, 4], 2))
        assert chunks == [[1, 2], [3, 4]]

    def test_uneven_split(self):
        chunks = list(_chunk([1, 2, 3], 2))
        assert chunks == [[1, 2], [3]]

    def test_empty(self):
        assert list(_chunk([], 10)) == []

    def test_batch_larger_than_list(self):
        assert list(_chunk([1, 2], 100)) == [[1, 2]]


# ---------------------------------------------------------------------------
# _merge_stats
# ---------------------------------------------------------------------------


class TestMergeStats:
    def test_accumulates_counts(self):
        a = LoaderStats(vertices_created=5, edges_created=3)
        b = LoaderStats(vertices_created=2, edges_created=4, vertices_failed=1)
        _merge_stats(a, b)
        assert a.vertices_created == 7
        assert a.edges_created == 7
        assert a.vertices_failed == 1

    def test_accumulates_by_label(self):
        a = LoaderStats(vertices_by_label={"Person": 3})
        b = LoaderStats(vertices_by_label={"Person": 2, "Movie": 5})
        _merge_stats(a, b)
        assert a.vertices_by_label == {"Person": 5, "Movie": 5}

    def test_accumulates_errors(self):
        a = LoaderStats(errors=["err1"])
        b = LoaderStats(errors=["err2", "err3"])
        _merge_stats(a, b)
        assert a.errors == ["err1", "err2", "err3"]


# ---------------------------------------------------------------------------
# CSVLoader — load_nodes_file
# ---------------------------------------------------------------------------


class TestLoadNodesFile:
    @pytest.mark.asyncio
    async def test_loads_vertices_and_builds_id_mapping(self):
        connector = _make_connector()
        loader = CSVLoader(connector)
        stats = await loader.load_nodes_file(FIXTURES / "nodes" / "person.csv")

        assert stats.vertices_created == 3
        assert stats.vertices_failed == 0
        assert stats.errors == []
        # id_mapping should have all 3 CSV source IDs
        assert "PERSON_1" in loader._id_mapping
        assert "PERSON_2" in loader._id_mapping
        assert "PERSON_3" in loader._id_mapping

    @pytest.mark.asyncio
    async def test_source_id_injected_into_properties(self):
        received_records: list[list[dict]] = []

        async def capture(label, records):
            received_records.append(records)
            return [Vertex(id=f"db-{i}", label=label, properties=dict(r)) for i, r in enumerate(records)]

        connector = _make_connector(vertex_factory=capture)
        loader = CSVLoader(connector)
        await loader.load_nodes_file(FIXTURES / "nodes" / "person.csv")

        for batch in received_records:
            for rec in batch:
                assert "_csv_source_id" in rec

    @pytest.mark.asyncio
    async def test_label_override(self):
        received_labels: list[str] = []

        async def capture(label, records):
            received_labels.append(label)
            return [Vertex(id=f"db-{i}", label=label, properties=dict(r)) for i, r in enumerate(records)]

        connector = _make_connector(vertex_factory=capture)
        loader = CSVLoader(connector)
        await loader.load_nodes_file(FIXTURES / "nodes" / "person.csv", label="Human")

        assert all(lbl == "Human" for lbl in received_labels)

    @pytest.mark.asyncio
    async def test_typed_int_properties_coerced(self):
        received_records: list[list[dict]] = []

        async def capture(label, records):
            received_records.append(records)
            return [Vertex(id=f"db-{i}", label=label, properties=dict(r)) for i, r in enumerate(records)]

        connector = _make_connector(vertex_factory=capture)
        loader = CSVLoader(connector)
        await loader.load_nodes_file(FIXTURES / "nodes" / "movie.csv")

        all_records = [r for batch in received_records for r in batch]
        for rec in all_records:
            assert isinstance(rec["released"], int)
            assert isinstance(rec["runtime"], int)

    @pytest.mark.asyncio
    async def test_stats_by_label(self):
        connector = _make_connector()
        loader = CSVLoader(connector)
        stats = await loader.load_nodes_file(FIXTURES / "nodes" / "person.csv")
        assert stats.vertices_by_label.get("Person") == 3

    @pytest.mark.asyncio
    async def test_dry_run_no_connector_call(self):
        connector = _make_connector()
        connector.bulk.bulk_create_vertices = AsyncMock(side_effect=AssertionError("should not be called"))
        loader = CSVLoader(connector, LoaderConfig(dry_run=True))
        stats = await loader.load_nodes_file(FIXTURES / "nodes" / "person.csv")
        assert stats.vertices_created == 3
        assert stats.dry_run is True
        connector.bulk.bulk_create_vertices.assert_not_called()

    @pytest.mark.asyncio
    async def test_batch_size_respected(self):
        call_sizes: list[int] = []

        async def capture(label, records):
            call_sizes.append(len(records))
            return [Vertex(id=f"db-{i}", label=label, properties=dict(r)) for i, r in enumerate(records)]

        connector = _make_connector(vertex_factory=capture)
        loader = CSVLoader(connector, LoaderConfig(batch_size=2))
        # person.csv has 3 rows → should result in batches of 2 and 1
        await loader.load_nodes_file(FIXTURES / "nodes" / "person.csv")
        assert call_sizes == [2, 1]

    @pytest.mark.asyncio
    async def test_connector_error_raises_by_default(self):
        async def fail(label, records):
            raise RuntimeError("DB down")

        connector = _make_connector(vertex_factory=fail)
        loader = CSVLoader(connector)
        with pytest.raises(RuntimeError, match="DB down"):
            await loader.load_nodes_file(FIXTURES / "nodes" / "person.csv")

    @pytest.mark.asyncio
    async def test_connector_error_skipped_when_skip_on_error(self):
        async def fail(label, records):
            raise RuntimeError("DB down")

        connector = _make_connector(vertex_factory=fail)
        loader = CSVLoader(connector, LoaderConfig(skip_on_error=True))
        stats = await loader.load_nodes_file(FIXTURES / "nodes" / "person.csv")
        assert stats.vertices_failed == 3
        assert len(stats.errors) == 1


# ---------------------------------------------------------------------------
# CSVLoader — load_edges_file
# ---------------------------------------------------------------------------


class TestLoadEdgesFile:
    async def _load_with_mapping(self, mapping: dict[str, str]) -> tuple[CSVLoader, LoaderStats]:
        connector = _make_connector()
        loader = CSVLoader(connector)
        # Pre-populate the ID mapping so edges can be resolved
        loader._id_mapping.update(mapping)
        stats = await loader.load_edges_file(FIXTURES / "relationships" / "acted_in.csv")
        return loader, stats

    @pytest.mark.asyncio
    async def test_loads_edges_with_resolved_ids(self):
        mapping = {
            "PERSON_1": "db-p1",
            "PERSON_2": "db-p2",
            "PERSON_3": "db-p3",
            "MOVIE_1": "db-m1",
            "MOVIE_2": "db-m2",
        }
        _, stats = await self._load_with_mapping(mapping)
        assert stats.edges_created == 3
        assert stats.edges_failed == 0

    @pytest.mark.asyncio
    async def test_unresolved_id_raises_by_default(self):
        connector = _make_connector()
        loader = CSVLoader(connector)
        # No id_mapping populated — all edges will fail to resolve
        with pytest.raises(ValueError, match="unresolved node reference"):
            await loader.load_edges_file(FIXTURES / "relationships" / "acted_in.csv")

    @pytest.mark.asyncio
    async def test_unresolved_id_skipped_when_skip_on_error(self):
        connector = _make_connector()
        loader = CSVLoader(connector, LoaderConfig(skip_on_error=True))
        # Only provide mapping for PERSON_1 and MOVIE_1 → only REL_1 resolves
        loader._id_mapping.update({"PERSON_1": "db-p1", "MOVIE_1": "db-m1"})
        stats = await loader.load_edges_file(FIXTURES / "relationships" / "acted_in.csv")
        assert stats.edges_created == 1
        assert stats.edges_failed == 2

    @pytest.mark.asyncio
    async def test_source_and_target_ids_passed_to_connector(self):
        received: list[dict] = []

        async def capture(label, records):
            received.extend(records)
            return [
                Edge(id=f"e-{i}", label=label, source=r["source_id"], target=r["target_id"])
                for i, r in enumerate(records)
            ]

        connector = _make_connector(edge_factory=capture)
        loader = CSVLoader(connector)
        loader._id_mapping.update(
            {"PERSON_1": "db-p1", "PERSON_2": "db-p2", "PERSON_3": "db-p3", "MOVIE_1": "db-m1", "MOVIE_2": "db-m2"}
        )
        await loader.load_edges_file(FIXTURES / "relationships" / "acted_in.csv")

        db_ids = {(r["source_id"], r["target_id"]) for r in received}
        assert ("db-p1", "db-m1") in db_ids
        assert ("db-p2", "db-m1") in db_ids
        assert ("db-p3", "db-m2") in db_ids

    @pytest.mark.asyncio
    async def test_dry_run_no_connector_call(self):
        connector = _make_connector()
        connector.bulk.bulk_create_edges = AsyncMock(side_effect=AssertionError("should not be called"))
        loader = CSVLoader(connector, LoaderConfig(dry_run=True))
        loader._id_mapping.update(
            {"PERSON_1": "db-p1", "PERSON_2": "db-p2", "PERSON_3": "db-p3", "MOVIE_1": "db-m1", "MOVIE_2": "db-m2"}
        )
        stats = await loader.load_edges_file(FIXTURES / "relationships" / "acted_in.csv")
        assert stats.edges_created == 3
        connector.bulk.bulk_create_edges.assert_not_called()


# ---------------------------------------------------------------------------
# CSVLoader — load_directory
# ---------------------------------------------------------------------------


class TestLoadDirectory:
    @pytest.mark.asyncio
    async def test_loads_nodes_and_edges_from_directory(self, tmp_path):
        # Build a minimal directory mirroring the fixtures layout
        (tmp_path / "nodes").mkdir()
        (tmp_path / "relationships").mkdir()
        (tmp_path / "nodes" / "person.csv").write_text("Id,Label,Properties:name\nP1,Person,Alice\nP2,Person,Bob\n")
        (tmp_path / "relationships" / "knows.csv").write_text("Id,Label,FromId,ToId\nR1,KNOWS,P1,P2\n")

        connector = _make_connector()
        loader = CSVLoader(connector)
        stats = await loader.load_directory(tmp_path)

        assert stats.vertices_created == 2
        assert stats.edges_created == 1

    @pytest.mark.asyncio
    async def test_nodes_only_directory(self, tmp_path):
        (tmp_path / "nodes").mkdir()
        (tmp_path / "nodes" / "item.csv").write_text("Id,Label,Properties:x\nI1,Item,1\n")

        connector = _make_connector()
        loader = CSVLoader(connector)
        stats = await loader.load_directory(tmp_path)

        assert stats.vertices_created == 1
        assert stats.edges_created == 0

    @pytest.mark.asyncio
    async def test_empty_directory(self, tmp_path):
        connector = _make_connector()
        loader = CSVLoader(connector)
        stats = await loader.load_directory(tmp_path)
        assert stats.vertices_created == 0
        assert stats.edges_created == 0

    @pytest.mark.asyncio
    async def test_nonexistent_directory_raises(self):
        connector = _make_connector()
        loader = CSVLoader(connector)
        with pytest.raises(FileNotFoundError):
            await loader.load_directory("/does/not/exist")

    @pytest.mark.asyncio
    async def test_multiple_node_files_sorted(self, tmp_path):
        """Nodes are loaded alphabetically — 'actor' before 'movie'."""
        (tmp_path / "nodes").mkdir()
        (tmp_path / "nodes" / "b_movie.csv").write_text("Id,Label,Properties:t\nM1,Movie,x\n")
        (tmp_path / "nodes" / "a_person.csv").write_text("Id,Label,Properties:n\nP1,Person,Alice\n")

        load_order: list[str] = []

        async def capture(label, records):
            load_order.append(label)
            return [Vertex(id=f"db-{i}", label=label, properties=dict(r)) for i, r in enumerate(records)]

        connector = _make_connector(vertex_factory=capture)
        loader = CSVLoader(connector)
        await loader.load_directory(tmp_path)

        assert load_order == ["Person", "Movie"]

    @pytest.mark.asyncio
    async def test_id_mapping_persists_across_files(self, tmp_path):
        """ID mapping built from node files is available when edges are loaded."""
        (tmp_path / "nodes").mkdir()
        (tmp_path / "relationships").mkdir()
        (tmp_path / "nodes" / "person.csv").write_text("Id,Label,Properties:name\nP1,Person,Alice\nP2,Person,Bob\n")
        (tmp_path / "relationships" / "knows.csv").write_text("Id,Label,FromId,ToId\nR1,KNOWS,P1,P2\n")

        connector = _make_connector()
        loader = CSVLoader(connector)
        stats = await loader.load_directory(tmp_path)

        assert stats.vertices_created == 2
        assert stats.edges_created == 1
        assert stats.edges_failed == 0
