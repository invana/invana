"""The rows a stitch's edges arrive as (load-data.md LD19 · stitch-models.md ST51-ST52).

No database: what is under test is where the rows are read from and what the write
carries. A row is both a record somebody loaded and an edge a stitch made, and the
provenance says both.
"""

import json

from invana.apps.modeller.models import ModelLink
from invana.apps.modeller.solve import ORIGIN, ORIGIN_KEY, STITCH_ID_KEY
from invana.runtime.catalogue.stitching import rows_path, write_query


def link(**kwargs) -> ModelLink:
    base = {
        "id": "link-9",
        "graph_id": "graph-1",
        "kind": "relationship",
        "status": "active",
        "source_version_id": "v1",
        "source_type": "Tweet",
        "target_version_id": "v2",
        "target_type": "Article",
        "edge_type": "ABOUT",
        "source_model_id": "m-twitter",
    }
    return ModelLink(**{**base, **kwargs})


class TestWhereTheRowsComeFrom:
    def test_the_records_ship_them_under_stitches(self, tmp_path):
        (tmp_path / "stitches").mkdir()
        (tmp_path / "stitches" / "ABOUT.json").write_text(json.dumps([]), encoding="utf-8")
        assert rows_path(tmp_path, "ABOUT") == tmp_path / "stitches" / "ABOUT.json"

    def test_a_folder_that_ships_none_says_nothing_rather_than_failing(self, tmp_path):
        assert rows_path(tmp_path, "ABOUT") is None


class TestWhatTheWriteCarries:
    def test_the_edge_is_merged_between_two_nodes_already_here(self):
        query = write_query("ABOUT")
        assert "MATCH (a {id: $from_id}), (b {id: $to_id})" in query
        assert "MERGE (a)-[r:`ABOUT`]->(b)" in query

    def test_it_is_both_a_record_and_a_stitch_edge(self):
        from invana.runtime.catalogue.stitching import _provenance

        prov = _provenance(link(), model_id="m-twitter", record_id="ABOUT_1", file="stitches/ABOUT.json")
        assert prov[ORIGIN_KEY] == ORIGIN
        assert prov[STITCH_ID_KEY] == "link-9"
        assert prov["_inv_model_id"] == "m-twitter"
        assert prov["_inv_record_id"] == "ABOUT_1"
