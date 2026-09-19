"""The bundle preflight — a declared stitch checked against the files (load-data.md LD12).

Three rules from the feature: the check counts distinct key values because the preview
does (LD13), a rule may declare that it only overlaps (LD14), and one that does not
declare it fails when anything is left unresolved.
"""

import json

import pytest

from invana.runtime.catalogue.bundle import BundleError, check, check_dataset, read_manifest


def write_bundle(root, manifest, datasets):
    """`datasets` is {name: {Type: [{id, properties}]}}."""
    (root / "stitches.json").write_text(json.dumps(manifest), encoding="utf-8")
    for name, types in datasets.items():
        for type_name, records in types.items():
            path = root / name / "nodes" / f"{type_name}.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(records), encoding="utf-8")


def write_dataset(root, name, *, model, nodes=None, edges=None, identity=None):
    """A dataset with its own graph-model.json, for the structural checks (LD15)."""
    base = root / name
    (base / "nodes").mkdir(parents=True, exist_ok=True)
    (base / "edges").mkdir(parents=True, exist_ok=True)
    (base / "graph-model.json").write_text(json.dumps({"model": model}), encoding="utf-8")
    if identity:
        (base / "model.json").write_text(json.dumps({"nodes": identity}), encoding="utf-8")
    for type_name, records in (nodes or {}).items():
        (base / "nodes" / f"{type_name}.json").write_text(json.dumps(records), encoding="utf-8")
    for type_name, records in (edges or {}).items():
        (base / "edges" / f"{type_name}.json").write_text(json.dumps(records), encoding="utf-8")


CITY_MODEL = {
    "property_keys": [
        {"name": "code", "type": "string", "validation_rules": []},
        {"name": "population", "type": "integer", "validation_rules": []},
        {
            "name": "size",
            "type": "enum",
            "validation_rules": [{"rule_type": "enum", "params": {"values": ["small", "large"]}}],
        },
    ],
    "node_types": [
        {"name": "City", "property_mappings": [{"property_key": k} for k in ("code", "population", "size")]},
        {"name": "Country", "property_mappings": [{"property_key": "code"}]},
    ],
    "edge_types": [
        {"name": "IN", "source_node_types": ["City"], "target_node_types": ["Country"], "property_mappings": []}
    ],
}


def node(node_id, **props):
    return {"id": node_id, "properties": props}


class TestResolving:
    def test_a_rule_that_matches_every_key_passes(self, tmp_path):
        write_bundle(
            tmp_path,
            {
                "name": "t",
                "datasets": ["left", "right"],
                "stitches": [
                    {"id": "A1", "kind": "anchor", "source": "left:City.code", "target": "right:airport.code"}
                ],
            },
            {
                "left": {"City": [node("c1", code="DEL"), node("c2", code="BOM")]},
                "right": {"airport": [node("a1", code="DEL"), node("a2", code="BOM"), node("a3", code="LHR")]},
            },
        )

        results = check(tmp_path).rules

        assert [r.passed for r in results] == [True]
        assert (results[0].resolved, results[0].total) == (2, 2)

    def test_keys_are_counted_distinct_not_rows(self, tmp_path):
        """Two airlines out of one hub is one key, two rows — what the preview reports."""
        write_bundle(
            tmp_path,
            {
                "name": "t",
                "datasets": ["left", "right"],
                "stitches": [
                    {
                        "id": "R1",
                        "kind": "relationship",
                        "edge_type": "HUBS_AT",
                        "source": "left:Airline.hub_code",
                        "target": "right:airport.code",
                    }
                ],
            },
            {
                "left": {"Airline": [node("x", hub_code="DEL"), node("y", hub_code="DEL")]},
                "right": {"airport": [node("a1", code="DEL")]},
            },
        )

        results = check(tmp_path).rules

        assert results[0].total == 1
        assert results[0].rows == 2
        assert results[0].passed

    def test_case_insensitive_folds_both_sides(self, tmp_path):
        write_bundle(
            tmp_path,
            {
                "name": "t",
                "datasets": ["left", "right"],
                "stitches": [
                    {
                        "id": "A1",
                        "kind": "anchor",
                        "identity_match": "case_insensitive",
                        "source": "left:Hashtag.tag",
                        "target": "right:Topic.tag",
                    }
                ],
            },
            {
                "left": {"Hashtag": [node("h", tag="RouteLaunch")]},
                "right": {"Topic": [node("t", tag="routelaunch")]},
            },
        )

        assert check(tmp_path).rules[0].passed


class TestRefusing:
    def test_an_unresolved_key_fails_the_rule(self, tmp_path):
        write_bundle(
            tmp_path,
            {
                "name": "t",
                "datasets": ["left", "right"],
                "stitches": [
                    {"id": "A1", "kind": "anchor", "source": "left:City.code", "target": "right:airport.code"}
                ],
            },
            {
                "left": {"City": [node("c1", code="DEL"), node("c2", code="NOWHERE")]},
                "right": {"airport": [node("a1", code="DEL")]},
            },
        )

        results = check(tmp_path).rules

        assert not results[0].passed
        assert results[0].unresolved == ["NOWHERE"]

    def test_partial_says_an_overlap_is_the_point(self, tmp_path):
        """The same data, with `partial` declared — LD14."""
        write_bundle(
            tmp_path,
            {
                "name": "t",
                "datasets": ["left", "right"],
                "stitches": [
                    {
                        "id": "A1",
                        "kind": "anchor",
                        "partial": True,
                        "source": "left:City.code",
                        "target": "right:airport.code",
                    }
                ],
            },
            {
                "left": {"City": [node("c1", code="DEL"), node("c2", code="NOWHERE")]},
                "right": {"airport": [node("a1", code="DEL")]},
            },
        )

        results = check(tmp_path).rules

        assert results[0].passed
        assert results[0].unresolved == ["NOWHERE"]

    def test_a_rule_naming_a_type_nobody_ships_is_an_error(self, tmp_path):
        write_bundle(
            tmp_path,
            {
                "name": "t",
                "datasets": ["left", "right"],
                "stitches": [
                    {"id": "A1", "kind": "anchor", "source": "left:Ghost.code", "target": "right:airport.code"}
                ],
            },
            {"left": {"City": [node("c1", code="DEL")]}, "right": {"airport": [node("a1", code="DEL")]}},
        )

        results = check(tmp_path).rules

        assert not results[0].passed
        assert "Ghost" in results[0].error

    @pytest.mark.parametrize(
        ("stitch", "says"),
        [
            ({"id": "x", "kind": "sideways", "source": "left:A.b", "target": "right:C.d"}, "kind"),
            ({"id": "x", "kind": "anchor", "source": "nonsense", "target": "right:C.d"}, "expected"),
            ({"id": "x", "kind": "anchor", "source": "absent:A.b", "target": "right:C.d"}, "bundle's datasets"),
            ({"id": "x", "kind": "relationship", "source": "left:A.b", "target": "right:C.d"}, "edge_type"),
        ],
    )
    def test_a_manifest_that_cannot_be_read_says_why(self, tmp_path, stitch, says):
        write_bundle(
            tmp_path,
            {"name": "t", "datasets": ["left", "right"], "stitches": [stitch]},
            {"left": {"A": [node("1", b="x")]}, "right": {"C": [node("2", d="x")]}},
        )

        with pytest.raises(BundleError) as exc:
            read_manifest(tmp_path)

        assert says in str(exc.value)

    def test_a_folder_without_a_manifest_is_not_a_bundle(self, tmp_path):
        with pytest.raises(BundleError, match=r"stitches\.json"):
            check(tmp_path)


class TestStructure:
    """Each dataset against its own model, before any rule is resolved (LD15)."""

    def good(self, tmp_path, **overrides):
        nodes = overrides.pop(
            "nodes",
            {
                "City": [node("c1", code="DEL", population=20, size="large")],
                "Country": [node("n1", code="IN")],
            },
        )
        edges = overrides.pop("edges", {"IN": [{"id": "e1", "from": "c1", "to": "n1", "properties": {}}]})
        write_dataset(
            tmp_path, "d", model=CITY_MODEL, nodes=nodes, edges=edges, identity={"City": {"identity": ["code"]}}
        )
        return check_dataset(tmp_path, "d")

    def test_a_clean_dataset_passes(self, tmp_path):
        result = self.good(tmp_path)
        assert result.passed, result.findings
        assert (result.nodes, result.edges) == (2, 1)

    @pytest.mark.parametrize(
        ("check_name", "nodes", "edges"),
        [
            (
                "identity_key_present",
                {"City": [node("c1", population=1, size="small")], "Country": [node("n1", code="IN")]},
                None,
            ),
            (
                "identity_key_unique",
                {
                    "City": [node("c1", code="DEL", size="small"), node("c2", code="DEL", size="small")],
                    "Country": [node("n1", code="IN")],
                },
                None,
            ),
            (
                "node_ids_unique",
                {"City": [node("c1", code="DEL"), node("c1", code="BOM")], "Country": [node("n1", code="IN")]},
                None,
            ),
            ("property_declared", {"City": [node("c1", code="DEL", bogus="x")]}, None),
            ("property_type", {"City": [node("c1", code="DEL", population="many")]}, None),
            ("enum_value", {"City": [node("c1", code="DEL", size="enormous")]}, None),
            (
                "endpoint_types",
                {"City": [node("c1", code="DEL"), node("c2", code="BOM")]},
                {"IN": [{"id": "e1", "from": "c1", "to": "c2", "properties": {}}]},
            ),
        ],
    )
    def test_each_check_can_fail(self, tmp_path, check_name, nodes, edges):
        """A check that cannot fail is worse than no check."""
        kwargs = {"nodes": nodes}
        if edges is not None:
            kwargs["edges"] = edges
        result = self.good(tmp_path, **kwargs)

        assert not result.passed
        assert check_name in {f.check for f in result.findings}

    def test_an_endpoint_outside_the_dataset_is_deferred_not_failed(self, tmp_path):
        """LD16 — offline, a missing endpoint is a question the import answers."""
        result = self.good(tmp_path, edges={"IN": [{"id": "e1", "from": "c1", "to": "elsewhere", "properties": {}}]})

        assert result.passed
        assert result.deferred == 1

    def test_the_report_fails_when_a_dataset_does(self, tmp_path):
        """The exit code has to see structure, not only rules."""
        write_dataset(
            tmp_path,
            "d",
            model=CITY_MODEL,
            nodes={"City": [node("c1", code="DEL", size="enormous")], "Country": [node("n1", code="IN")]},
            identity={"City": {"identity": ["code"]}},
        )
        (tmp_path / "stitches.json").write_text(json.dumps({"name": "t", "datasets": ["d"], "stitches": []}))

        report = check(tmp_path)

        assert not report.passed
        assert all(r.passed for r in report.rules)
