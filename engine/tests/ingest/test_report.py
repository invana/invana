"""The validation report — grouped by reason, never silent.

Two rules from inspect-what-landed.md: a rejection always carries a reason (BD4),
and rejections group by reason so one bad column is one line rather than four
thousand (IW2).
"""

from invana.runtime.catalogue.records import group_report


class TestGrouping:
    def test_one_bad_column_is_one_line(self):
        errors = [
            {"file": "nodes/Article.json", "rule": "invalid_property", "message": "nse_symbol unknown"}
            for _ in range(412)
        ]
        groups = group_report(errors)

        assert len(groups) == 1
        assert groups[0]["count"] == 412
        assert groups[0]["files"] == {"nodes/Article.json": 412}
        # The rows are still one click away, but they are not the headline.
        assert len(groups[0]["samples"]) == 5

    def test_groups_sort_by_how_much_they_cost(self):
        errors = [
            *({"file": "a.json", "rule": "unresolved_endpoint"} for _ in range(7)),
            *({"file": "b.json", "rule": "invalid_property"} for _ in range(40)),
        ]
        groups = group_report(errors)

        assert [g["reason"] for g in groups] == ["invalid_property", "unresolved_endpoint"]
        assert [g["count"] for g in groups] == [40, 7]

    def test_a_rejection_with_no_rule_still_gets_a_reason(self):
        groups = group_report([{"file": "a.json", "message": "something went wrong"}])

        assert groups[0]["reason"] == "something went wrong"

    def test_nothing_rejected_is_no_groups(self):
        assert group_report([]) == []
