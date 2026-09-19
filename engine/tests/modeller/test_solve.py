"""Solving a stitch — the query a rule turns into (stitch-models.md ST44-ST49).

No database here: what is under test is the shape of the write. An anchor writes
`SAME_AS`, a keyed relationship writes its own edge type, a dataset-sourced one writes
nothing, and every edge carries the marks that say a rule derived it.
"""

from invana.apps.modeller.models import ModelLink
from invana.apps.modeller.solve import (
    ANCHOR_EDGE,
    ORIGIN,
    ORIGIN_KEY,
    RULE_KEY,
    STITCH_ID_KEY,
    edge_of,
    solvable,
    solve_query,
    stamp,
    withdraw_query,
)


def link(**kwargs) -> ModelLink:
    base = {
        "id": "link-1",
        "graph_id": "graph-1",
        "kind": "relationship",
        "status": "active",
        "source_version_id": "v1",
        "source_type": "City",
        "target_version_id": "v2",
        "target_type": "airport",
        "source_property": "code",
        "target_property": "code",
        "identity_match": "exact",
        "edge_type": "SERVED_BY",
    }
    return ModelLink(**{**base, **kwargs})


class TestWhatEachKindWrites:
    def test_a_relationship_writes_its_own_edge_type(self):
        query = solve_query(link())
        assert "MERGE (a)-[r:`SERVED_BY`]->(b)" in query
        assert "a.`code`" in query and "b.`code`" in query

    def test_an_anchor_writes_same_as(self):
        anchor = link(kind="anchor", edge_type=None, source_type="Country", target_type="country")
        assert edge_of(anchor) == ANCHOR_EDGE
        assert f"MERGE (a)-[r:`{ANCHOR_EDGE}`]->(b)" in solve_query(anchor)

    def test_a_model_sourced_relationship_is_not_solvable(self):
        # Its rows are its own fact and arrive with the records (ST45).
        assert not solvable(link(source_property=None, target_property=None, source_model_id="m-1"))

    def test_case_insensitive_folds_both_sides(self):
        query = solve_query(link(identity_match="case_insensitive", target_type="Topic"))
        assert query.count("toLower(toString(") == 2


class TestTheMarksItLeaves:
    def test_every_edge_says_a_rule_made_it(self):
        marks = stamp(link())
        assert marks[ORIGIN_KEY] == ORIGIN
        assert marks[STITCH_ID_KEY] == "link-1"
        assert marks[RULE_KEY] == "City.code = airport.code"

    def test_a_withdrawal_finds_only_its_own(self):
        assert f"r.`{STITCH_ID_KEY}` = $stitch_id" in withdraw_query()
        assert "DELETE r" in withdraw_query()


class TestScopingToOneLoad:
    def test_a_load_solves_over_what_it_just_wrote(self):
        # Either side being new is enough — the standing rule has to reach records
        # that were already here (ST47).
        query = solve_query(link(), scoped=True)
        assert "a.`_inv_run_id` = $run_id OR b.`_inv_run_id` = $run_id" in query

    def test_a_commit_runs_over_everything(self):
        assert "_inv_run_id" not in solve_query(link())
