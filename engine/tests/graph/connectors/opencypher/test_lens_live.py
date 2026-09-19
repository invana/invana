"""A lens, against real databases
(docs/for-developers/building-engine/lens-migration.md P1).

The compiler's own tests prove the rewrite *says* the right thing. These prove
the claim the product actually makes: with `Deal.revenue` excluded, no query
returns it, no aggregate reveals it, and `RETURN d` comes back without it — from
a database that is holding the value the whole time.

That last part is what makes these worth running. The row on disk has a revenue;
if the bound were a display filter, every one of these would still pass while the
number crossed the wire. So each one is paired with the same query run *without*
a lens, which must return it.

Runs against every live openCypher backend — the identity function differs
between them, and the projection is written in it.
"""

from __future__ import annotations

import pytest

from invana.graph.connectors.base.exceptions import LensViolationError
from invana.graph.types.filter_types import FilterOp
from invana.graph.types.filters import FilterExpression, FilterGroup
from invana.graph.types.lens import QueryLens, TypeBound

DECLARED = frozenset({"name", "stage", "observed_at", "revenue"})
NO_REVENUE = QueryLens(bounds={"Deal": TypeBound("Deal", declared=DECLARED, excluded=frozenset({"revenue"}))})
H1_ONLY = QueryLens(
    bounds={
        "Deal": TypeBound(
            type_name="Deal",
            declared=DECLARED,
            predicates=FilterGroup(
                conditions=[
                    FilterExpression(property="observed_at", op=FilterOp.GTE, value="2026-01-01"),
                    FilterExpression(property="observed_at", op=FilterOp.LTE, value="2026-06-30"),
                ]
            ),
        )
    }
)


@pytest.fixture
async def deals(connector):
    """Three deals, each carrying a revenue, two of them inside H1."""
    await connector.execute(
        "CREATE (:Deal {name: 'Ayo', stage: 'won', observed_at: '2026-02-01', revenue: 900}),"
        " (:Deal {name: 'Bea', stage: 'won', observed_at: '2026-05-01', revenue: 100}),"
        " (:Deal {name: 'Cy',  stage: 'won', observed_at: '2026-09-01', revenue: 500})"
    )


async def run(connector, query: str, lens: QueryLens):
    """Execute under *lens* — through the connector, the way the product does."""
    response = await connector.execute(query, lens=lens)
    return response.metadata.composed, response


class TestAnExcludedPropertyNeverArrives:
    async def test_the_database_is_holding_it(self, connector, deals):
        """The negative control. Without a lens the value comes back, so the rest means something."""
        response = await connector.execute("MATCH (d:Deal) RETURN d.revenue AS r")

        assert sorted(r["r"] for r in response.records) == [100, 500, 900]

    async def test_a_whole_node_comes_back_without_it(self, connector, deals):
        composed, response = await run(connector, "MATCH (d:Deal) RETURN d", NO_REVENUE)

        assert len(response.nodes) == 3
        for node in response.nodes:
            assert "revenue" not in node.properties
            assert set(node.properties) == {"name", "stage", "observed_at"}
        assert composed.rewritten

    async def test_it_is_still_a_node(self, connector, deals):
        """A governed node keeps its identity and label, so the canvas still has a graph (CC13)."""
        _, response = await run(connector, "MATCH (d:Deal) RETURN d", NO_REVENUE)

        assert all(node.id and node.label == "Deal" for node in response.nodes)

    async def test_the_trace_carries_both_queries(self, connector, deals):
        composed, _ = await run(connector, "MATCH (d:Deal) RETURN d", NO_REVENUE)

        assert composed.digests["generated"] != composed.digests["executed"]
        assert composed.generated == "MATCH (d:Deal) RETURN d"


class TestTheDoorIsWired:
    """`execute(lens=)` is the seam — not something a caller assembles itself."""

    async def test_no_lens_leaves_the_query_untouched(self, connector, deals):
        response = await connector.execute("MATCH (d:Deal) RETURN d.revenue AS r")

        assert response.metadata.composed.rewritten is False
        assert response.metadata.composed.digests["generated"] == response.metadata.composed.digests["executed"]

    async def test_a_refusal_happens_before_the_wire(self, connector, deals):
        """Nothing ran, so this is not a query that failed (CC10)."""
        with pytest.raises(LensViolationError) as caught:
            await connector.execute("MATCH (d:Deal) RETURN avg(d.revenue) AS a", lens=NO_REVENUE)

        assert caught.value.code == "lens_property_excluded"
        assert caught.value.property_name == "revenue"


class TestTheSliceIsComposedNotFiltered:
    async def test_rows_outside_the_slice_do_not_come_back(self, connector, deals):
        _, response = await run(connector, "MATCH (d:Deal) RETURN d.name AS n", H1_ONLY)

        assert sorted(r["n"] for r in response.records) == ["Ayo", "Bea"]

    async def test_an_aggregate_counts_only_the_slice(self, connector, deals):
        """The difference between a bound and a display filter, in one number."""
        _, lensed = await run(connector, "MATCH (d:Deal) RETURN count(d) AS c", H1_ONLY)
        ungoverned = await connector.execute("MATCH (d:Deal) RETURN count(d) AS c")

        assert lensed.records[0]["c"] == 2
        assert ungoverned.records[0]["c"] == 3

    async def test_a_sum_cannot_reach_outside_the_slice(self, connector, deals):
        _, response = await run(connector, "MATCH (d:Deal) RETURN sum(d.revenue) AS total", H1_ONLY)

        assert response.records[0]["total"] == 1000  # not 1500
