"""The Database tab: the mirror, each row marked against the models.

From the-model-page.md: a row is in both, model only or database only (MP9); an
index matches by what it covers, never its name (MP27); a connector that does not
list its schema says so rather than answering empty (MP26). Real databases only —
each test creates its own scratch label and removes it, and never flushes.
"""

import uuid

import pytest
import pytest_asyncio

from invana.apps.graphs.models import Graph
from invana.apps.modeller.managers import PhysicalSchemaManager
from invana.apps.modeller.versioner import Versioner
from invana.core.auth.models import User
from invana.core.errors import NotFoundError
from tests.graph.connectors.backends import MEMGRAPH, NEO4J

physical = PhysicalSchemaManager()


@pytest_asyncio.fixture
async def graph_id(session):
    user = User(
        username=f"owner{uuid.uuid4().hex[:6]}",
        email=f"{uuid.uuid4().hex[:8]}@invana.test",
        password_hash="x",
        first_name="Owner",
    )
    session.add(user)
    await session.flush()
    graph = Graph(name="airways", slug=f"airways-{uuid.uuid4().hex[:6]}", created_by_id=user.id)
    session.add(graph)
    await session.flush()
    return graph.id


@pytest_asyncio.fixture
async def neo4j():
    if not NEO4J.is_up():
        pytest.skip(f"Neo4j is not running — {NEO4J.compose}")
    connector = NEO4J.connector()
    await connector.connect()
    yield connector
    await connector.disconnect()


async def _version(session, store, *, name, graph_id, origin="studio", labels=(), indexes=()):
    model = await store.create_graph_model(session, name=name, graph_id=graph_id, origin=origin)
    draft = await store.create_version(session, model_id=model.id)
    for label in labels:
        await store.create_node_type(session, version_id=draft.id, name=label)
    for index_name, label, prop in indexes:
        await store.create_index(
            session,
            version_id=draft.id,
            name=index_name,
            target_kind="node_type",
            target_label=label,
            properties=[prop],
            index_type="range",
        )
    await session.flush()
    await Versioner(store).activate(session, version_id=draft.id)
    await session.flush()
    return model


@pytest.mark.asyncio
class TestDrift:
    async def test_each_row_is_marked_and_unmodelled_sorts_first(self, session, store, graph_id, neo4j):
        tag = uuid.uuid4().hex[:6]
        airport, legacy = f"ZzAirport{tag}", f"ZzLegacy{tag}"
        # The mirror holds airport and an unmodelled label; its index on airport.code
        # has the vendor's name, not the model's.
        await _version(
            session,
            store,
            name="global",
            graph_id=graph_id,
            origin="introspected",
            labels=[airport, legacy],
            indexes=[(f"index_{tag}", airport, "code")],
        )
        model = await _version(
            session,
            store,
            name="AirRoutes",
            graph_id=graph_id,
            labels=[airport, f"ZzDeal{tag}"],
            indexes=[(f"airport_code_{tag}", airport, "code"), (f"airport_city_{tag}", airport, "city")],
        )

        read = await physical.read(session, graph_id=graph_id, connector=neo4j)

        assert read.lists_schema and read.captured_at is not None
        assert read.declared_indexes == 2
        assert [(r.name, r.drift) for r in read.labels] == [
            (legacy, "database_only"),
            (f"ZzDeal{tag}", "model_only"),
            (airport, "in_both"),
        ]
        assert read.labels[2].models == ["AirRoutes"] and read.labels[2].count == 0
        assert {(r.properties[0], r.drift) for r in read.indexes} == {("city", "model_only"), ("code", "in_both")}

        one = await physical.read(session, graph_id=graph_id, connector=neo4j, model_id=model.id)
        assert legacy not in [r.name for r in one.labels]

    async def test_a_connector_that_does_not_list_says_so(self, session, store, graph_id):
        await _version(session, store, name="global", graph_id=graph_id, origin="introspected", labels=["Zz"])

        read = await physical.read(session, graph_id=graph_id, connector=None)

        assert not read.lists_schema
        assert read.indexes == [] and read.constraints == []
        assert read.labels[0].count is None

    async def test_never_introspected_and_an_unknown_model(self, session, store, graph_id):
        read = await physical.read(session, graph_id=graph_id, connector=None)
        assert read.captured_at is None and read.labels == []

        with pytest.raises(NotFoundError):
            await physical.read(session, graph_id=graph_id, connector=None, model_id=str(uuid.uuid4()))


@pytest.mark.asyncio
async def test_memgraph_lists_its_indexes_and_constraints():
    if not MEMGRAPH.is_up():
        pytest.skip(f"Memgraph is not running — {MEMGRAPH.compose}")
    label = f"ZzProbe{uuid.uuid4().hex[:6]}"
    connector = MEMGRAPH.connector()
    await connector.connect()
    made = [f"INDEX ON :{label}(code)", f"CONSTRAINT ON (n:{label}) ASSERT n.code IS UNIQUE"]
    try:
        for ddl in made:
            await connector.execute(f"CREATE {ddl}")
        indexes = await connector.schema_reader.get_indexes()
        constraints = await connector.schema_reader.get_constraints()
    finally:
        for ddl in made:
            await connector.execute(f"DROP {ddl}")
        await connector.disconnect()

    assert connector.schema_reader.lists_schema
    assert [(i.properties, i.type) for i in indexes if i.label == label] == [(["code"], "btree")]
    assert [(c.properties, c.type) for c in constraints if c.label == label] == [(["code"], "unique")]
