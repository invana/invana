"""What a fanned-out node exposes (orchestration.md § 5.1b).

The roll-up follows the output's **declared type** — that is the whole point of
declaring one. Nothing here touches a database: the rule is a function of the
catalogue entry and the lanes' outputs.
"""

from __future__ import annotations

from invana.runtime.catalogue.registry import Bound, Entry, Type
from invana.runtime.interpreter.lanes import Lane, aggregate

LOAD = Entry(
    key="load",
    bound=Bound.graph_write,
    run=lambda: None,
    outputs={
        "written": Type.int_,
        "rows": Type.list_,
        "truncated": Type.bool_,
        "report": Type.obj,
    },
)


def _lanes() -> list[Lane]:
    return [
        Lane(key="0", succeeded=True, output={"written": 10, "rows": ["a"], "truncated": False, "report": {"x": 1}}),
        Lane(key="1", succeeded=True, output={"written": 2, "rows": ["b", "c"], "truncated": True, "report": {}}),
        Lane(key="2", succeeded=False, output={"written": 99, "rows": ["z"]}, reason="timeout"),
    ]


class TestAggregation:
    def test_counts_are_on_every_fanned_out_node(self):
        out = aggregate(LOAD, _lanes())
        assert (out["lanes"], out["succeeded"], out["failed"]) == (3, 2, 1)
        assert out["failed_lanes"] == [{"lane": "2", "reason": "timeout"}]

    def test_an_int_is_summed_and_a_list_concatenated_over_succeeded_lanes(self):
        out = aggregate(LOAD, _lanes())
        # The failed lane's 99 and its "z" do not count — `written > 0` must not
        # be true for a load that wrote nothing.
        assert out["written"] == 12
        assert out["rows"] == ["a", "b", "c"]

    def test_anything_else_declared_is_not_exposed(self):
        out = aggregate(LOAD, _lanes())
        # A bool and an obj have no roll-up: bind them per lane.
        assert "truncated" not in out
        assert "report" not in out

    def test_an_undeclared_key_is_not_exposed_whatever_a_lane_returned(self):
        lanes = [Lane(key="0", succeeded=True, output={"written": 1, "sneaked": [1, 2]})]
        assert "sneaked" not in aggregate(LOAD, lanes)

    def test_no_lanes_is_zero_rather_than_absent(self):
        out = aggregate(LOAD, [])
        assert out["lanes"] == 0 and out["written"] == 0 and out["rows"] == []
