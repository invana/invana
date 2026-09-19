"""The Cypher lens compiler, read as text
(docs/for-developers/modules/graph-connectors/features/the-connector-contract.md).

Compiling is a pure function from query text to query text, so these need no
database — the rewrite either says what it should or it does not. What the
*database* has to confirm is a different claim, and it gets its own tests: that
the rewritten query runs, and that the excluded value genuinely never comes back.

Both halves are tested here because both are required (CC8): rewriting alone does
not stop `avg(d.revenue)`, and rejection alone does not stop `RETURN d`.
"""

from __future__ import annotations

import pytest

from invana.graph.connectors.base.exceptions import LensViolationError
from invana.graph.connectors.cypher.lens import CypherLensCompiler
from invana.graph.types.filter_types import FilterOp
from invana.graph.types.filters import FilterExpression, FilterGroup
from invana.graph.types.lens import QueryLens, TypeBound

DEAL = TypeBound(
    type_name="Deal",
    declared=frozenset({"name", "stage", "country_iso", "observed_at", "revenue"}),
    excluded=frozenset({"revenue"}),
)
LENS = QueryLens(bounds={"Deal": DEAL})


def compile_(query: str, lens: QueryLens = LENS, params: dict | None = None):
    return CypherLensCompiler().compile(query, params, lens)


def refusal(query: str, lens: QueryLens = LENS) -> LensViolationError:
    with pytest.raises(LensViolationError) as caught:
        compile_(query, lens)
    return caught.value


class TestTheWidestLensChangesNothing:
    def test_an_empty_lens_leaves_the_query_byte_identical(self):
        """A Graph that never set a lens must not have its queries touched (GV7)."""
        query = "MATCH (d:Deal) RETURN d"
        out = compile_(query, QueryLens())

        assert out.executed == query
        assert out.rewritten is False
        assert out.digests["generated"] == out.digests["executed"]

    def test_a_type_the_lens_does_not_name_is_untouched(self):
        out = compile_("MATCH (p:Person) RETURN p")

        assert out.executed == "MATCH (p:Person) RETURN p"
        assert out.projected == ()


class TestReject:
    """Any reference to an excluded property, anywhere (C10)."""

    @pytest.mark.parametrize(
        "query",
        [
            "MATCH (d:Deal) RETURN d.revenue",
            "MATCH (d:Deal) RETURN avg(d.revenue)",
            "MATCH (d:Deal) WHERE d.revenue > 100 RETURN d.name",
            "MATCH (d:Deal) RETURN d.name ORDER BY d.revenue",
            "MATCH (d:Deal) RETURN d { .name, .revenue }",
        ],
        ids=["returned", "inside-an-aggregate", "in-a-predicate", "in-order-by", "in-a-projection"],
    )
    def test_an_excluded_property_is_refused(self, query):
        exc = refusal(query)

        assert exc.code == "lens_property_excluded"
        assert exc.property_name == "revenue"
        assert exc.type_name == "Deal"

    def test_the_refusal_says_what_this_world_does_not_carry(self):
        assert "does not carry Deal.revenue" in str(refusal("MATCH (d:Deal) RETURN d.revenue"))

    def test_a_denied_type_is_refused_by_name(self):
        lens = QueryLens(bounds={"Deal": DEAL}, allowed_types=frozenset({"Deal"}))
        exc = refusal("MATCH (p:Publisher) RETURN p", lens)

        assert exc.code == "lens_type_denied"
        assert "no Publisher" in str(exc)

    def test_excluding_without_declaring_has_nothing_to_project_to(self):
        lens = QueryLens(bounds={"Deal": TypeBound("Deal", excluded=frozenset({"revenue"}))})
        assert refusal("MATCH (d:Deal) RETURN d", lens).code == "lens_unprojectable"


class TestTheReadableSubset:
    """Fail closed — what the compiler cannot bound, it refuses (C11, CC10)."""

    @pytest.mark.parametrize(
        "query",
        [
            "MATCH (n) RETURN n",
            "MATCH (d:Deal) RETURN *",
            "MATCH (d:Deal) RETURN properties(d)",
            "MATCH (d:Deal) RETURN keys(d)",
            "MATCH (d:Deal) RETURN d[$key]",
            "MATCH (d:Deal) RETURN collect(d)",
            "MATCH (d:Deal) WITH collect(d) AS ds RETURN ds",
            "CALL db.labels() YIELD label RETURN label",
        ],
        ids=[
            "an-unlabelled-binding",
            "return-star",
            "the-property-bag",
            "the-property-keys",
            "a-dynamic-property",
            "carried-whole-into-a-list",
            "carried-whole-through-with",
            "a-procedure-call",
        ],
    )
    def test_a_shape_it_cannot_bound_is_refused(self, query):
        assert refusal(query).code == "lens_unreadable"

    def test_a_refusal_names_the_fragment_it_could_not_read(self):
        assert refusal("MATCH (d:Deal) RETURN collect(d)").fragment

    def test_counting_a_governed_element_is_allowed(self):
        """`count(d)` leaks no property value — refusing it would cost a real answer."""
        out = compile_("MATCH (d:Deal) RETURN count(d)")

        assert out.executed == "MATCH (d:Deal) RETURN count(d)"

    def test_an_explicit_permitted_projection_is_left_alone(self):
        """`d { .name }` already names what it takes — it is not carrying `d`."""
        out = compile_("MATCH (d:Deal) RETURN d { .name, .stage }")

        assert out.rewritten is False

    def test_a_named_exclusion_outranks_an_unreadable_shape(self):
        """`collect(d)` is unreadable *and* names revenue — the better message wins (CC16)."""
        exc = refusal("MATCH (d:Deal) RETURN collect(d), d.revenue")

        assert exc.code == "lens_property_excluded"

    def test_a_literal_is_text_not_a_reference(self):
        """The word `revenue` inside a string is not a property reference."""
        out = compile_("MATCH (d:Deal) WHERE d.name = 'revenue' RETURN d.name")

        assert out.rewritten is False


class TestProject:
    """A whole-element return becomes the permitted set (C9)."""

    def test_a_whole_node_return_is_rewritten(self):
        out = compile_("MATCH (d:Deal) RETURN d")

        assert "revenue" not in out.executed
        assert ".name" in out.executed and ".stage" in out.executed
        assert out.projected == ("Deal.d",)
        assert out.digests["generated"] != out.digests["executed"]

    def test_the_projection_keeps_the_column_name(self):
        assert compile_("MATCH (d:Deal) RETURN d").executed.endswith("AS d")

    def test_it_stays_a_node(self):
        """The serializer's own node shape, so the canvas still sees a node (CC13)."""
        executed = compile_("MATCH (d:Deal) RETURN d").executed

        assert "element_id: elementId(d)" in executed
        assert "labels: labels(d)" in executed

    def test_an_alias_is_followed_through_with(self):
        out = compile_("MATCH (d:Deal) WITH d AS x RETURN x")

        assert "revenue" not in out.executed
        assert out.executed.endswith("AS x")

    def test_a_relationship_is_projected_as_a_relationship(self):
        """Its endpoints come with it, or the edge cannot be drawn (CC13)."""
        lens = QueryLens(
            bounds={
                "WON_BY": TypeBound(
                    "WON_BY", declared=frozenset({"at", "commission"}), excluded=frozenset({"commission"})
                )
            }
        )
        executed = compile_("MATCH (a:Deal)-[r:WON_BY]->(b:Person) RETURN r", lens).executed

        assert "type: type(r)" in executed
        assert "start_node_element_id" in executed and "end_node_element_id" in executed
        assert "commission" not in executed

    def test_two_governed_variables_are_both_projected(self):
        lens = QueryLens(
            bounds={
                "Deal": DEAL,
                "Person": TypeBound("Person", declared=frozenset({"name", "ssn"}), excluded=frozenset({"ssn"})),
            }
        )
        out = compile_("MATCH (d:Deal)-[:WON_BY]->(p:Person) RETURN d, p", lens)

        assert "revenue" not in out.executed and "ssn" not in out.executed
        assert sorted(out.projected) == ["Deal.d", "Person.p"]

    def test_a_type_with_nothing_excluded_is_returned_as_itself(self):
        """No exclusions, no rewrite — a real node beats a reconstructed one."""
        lens = QueryLens(bounds={"Deal": TypeBound("Deal", declared=DEAL.declared)})
        out = compile_("MATCH (d:Deal) RETURN d", lens)

        assert out.executed == "MATCH (d:Deal) RETURN d"


class TestCompose:
    """The selector is folded in before execution, never filtered after (C8)."""

    SLICED = QueryLens(
        bounds={
            "Deal": TypeBound(
                type_name="Deal",
                declared=DEAL.declared,
                excluded=frozenset(),
                predicates=FilterGroup(
                    conditions=[
                        FilterExpression(property="observed_at", op=FilterOp.GTE, value="2026-01-01"),
                        FilterExpression(property="observed_at", op=FilterOp.LTE, value="2026-06-30"),
                    ]
                ),
            )
        }
    )

    def test_the_predicate_is_composed_into_the_query(self):
        out = compile_("MATCH (d:Deal) RETURN d.name", self.SLICED)

        assert "WITH * WHERE" in out.executed
        assert "d.observed_at >=" in out.executed
        assert out.composed == ("Deal.d",)

    def test_the_values_ride_as_parameters(self):
        out = compile_("MATCH (d:Deal) RETURN d.name", self.SLICED)

        assert sorted(out.parameters) == ["lens_p0", "lens_p1"]
        assert "2026-01-01" not in out.executed

    def test_it_survives_an_existing_where(self):
        out = compile_("MATCH (d:Deal) WHERE d.stage = 'won' RETURN d.name", self.SLICED)

        assert "d.stage = 'won'" in out.executed
        assert "WITH * WHERE" in out.executed

    def test_an_aggregate_cannot_escape_the_slice(self):
        """The count is of the slice, because the barrier is upstream of it."""
        out = compile_("MATCH (d:Deal) RETURN count(d)", self.SLICED)

        assert out.executed.index("WITH * WHERE") < out.executed.index("count(d)")
