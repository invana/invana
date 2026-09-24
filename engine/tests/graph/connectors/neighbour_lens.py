"""One lens scenario for the structured readers, run by every live backend of both languages (CC22).

Neighbours (GC10), type counts (SP11) and resolving a canvas (GC14).

The neighbour reader builds its own query, so the lens reaches it as structured
input and is composed into what it builds — on OpenCypher **and** Gremlin, and
therefore on every connector built on either. Each language package runs this
class against each of its backends.
"""

from __future__ import annotations

import pytest

from invana.graph.connectors.base.exceptions import LensViolationError
from invana.graph.types.filter_types import FilterOp
from invana.graph.types.filters import FilterExpression, FilterGroup
from invana.graph.types.lens import QueryLens, TypeBound

#: People and who they know — no companies, no ages, and only New York.
WORLD = QueryLens(
    allowed_types=frozenset({"Person", "KNOWS"}),
    bounds={
        "Person": TypeBound(
            type_name="Person",
            declared=frozenset({"name", "age", "city"}),
            excluded=frozenset({"age"}),
            predicates=FilterGroup(conditions=[FilterExpression(property="city", op=FilterOp.EQ, value="NYC")]),
        )
    },
)


@pytest.fixture
async def seeded(connector):
    alice = await connector.data_writer.create_vertex("Person", {"name": "Alice", "age": 30, "city": "NYC"})
    bob = await connector.data_writer.create_vertex("Person", {"name": "Bob", "age": 25, "city": "LA"})
    charlie = await connector.data_writer.create_vertex("Person", {"name": "Charlie", "age": 35, "city": "NYC"})
    acme = await connector.data_writer.create_vertex("Company", {"name": "Acme Corp"})
    await connector.data_writer.create_edge("KNOWS", alice.id, bob.id, {"since": 2020})
    await connector.data_writer.create_edge("KNOWS", alice.id, charlie.id, {"since": 2018})
    await connector.data_writer.create_edge("WORKS_AT", alice.id, acme.id, {"role": "Engineer"})
    gone = await connector.data_writer.create_vertex("Person", {"name": "Gone", "city": "NYC"})
    await connector.data_writer.delete_vertex(gone.id)
    return {"alice": alice, "bob": bob, "charlie": charlie, "acme": acme, "gone": gone}


class NeighbourLensContract:
    async def test_an_expansion_sees_only_the_world(self, connector, seeded):
        """Type, property and records grains, all three in the query that ran."""
        alice = seeded["alice"]

        response = await connector.data_reader.read_neighbors(alice.id, lens=WORLD)
        total = await connector.data_reader.count_neighbors(alice.id, lens=WORLD)

        # Acme and WORKS_AT are not in the world; Bob is outside the slice.
        assert {e.label for e in response.edges} == {"KNOWS"}
        names = {v.properties.get("name") for v in response.nodes}
        assert names == {"Alice", "Charlie"}
        assert total == 1
        # Nobody's age travels, the anchor's included.
        assert all("age" not in v.properties for v in response.nodes)

    async def test_naming_what_the_world_lacks_is_refused(self, connector, seeded):
        alice = seeded["alice"]

        with pytest.raises(LensViolationError) as denied:
            await connector.data_reader.read_neighbors(alice.id, edge_label="WORKS_AT", lens=WORLD)
        assert denied.value.code == "lens_type_denied"

        age = FilterGroup(conditions=[FilterExpression(property="age", op=FilterOp.GT, value=20)])
        with pytest.raises(LensViolationError) as excluded:
            await connector.data_reader.count_neighbors(alice.id, filters=age, lens=WORLD)
        assert excluded.value.code == "lens_property_excluded"


class TypeCountLensContract:
    async def test_counts_are_taken_inside_the_world(self, connector, seeded):
        """Company and WORKS_AT are not in the world; Bob and his KNOWS edge are outside the slice."""
        everything = await connector.schema_reader.count_types()
        nodes, edges = await connector.schema_reader.count_types(WORLD)

        assert everything[0]["Person"] == 3
        assert nodes == {"Person": 2}
        assert edges == {"KNOWS": 1}


class ResolveLensContract:
    async def test_the_world_decides_what_a_reopened_canvas_holds(self, connector, seeded):
        ids = [seeded[k].id for k in ("alice", "bob", "acme", "gone")]

        resolved = await connector.data_reader.resolve_vertices(ids, lens=WORLD)

        # Alice is in the world; Bob (sliced out) and Acme (denied) are held but
        # outside it; the deleted vertex is not held at all.
        assert resolved == {seeded["alice"].id: True, seeded["bob"].id: False, seeded["acme"].id: False}
