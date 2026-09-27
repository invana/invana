"""Growth: count snapshots, written by the act that wrote data, read as a stepped line.

From the-model-page.md: a snapshot follows the act and never fails it (MP30);
degree is a histogram reduced in the engine (MP31); a day's value is the last
count at or before its end, opening on the last count before the window (MP32).
Real databases only — the Neo4j reads here count, they never write.
"""

import uuid
from datetime import UTC, date, datetime

import pytest
import pytest_asyncio

from invana.apps.graphs.models import Graph
from invana.apps.modeller.managers import CountSnapshotManager, InsightsManager
from invana.apps.modeller.managers.count_snapshots import degree_stats
from invana.apps.modeller.models import TypeCountSnapshot
from invana.apps.modeller.versioner import Versioner
from invana.core.auth.models import User
from tests.graph.connectors.backends import NEO4J

TODAY = date(2026, 9, 27)


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


async def _published(session, store, *, graph_id, name, nodes=(), edges=()):
    model = await store.create_graph_model(session, name=name, graph_id=graph_id)
    draft = await store.create_version(session, model_id=model.id)
    for n in nodes:
        await store.create_node_type(session, version_id=draft.id, name=n)
    for e in edges:
        await store.create_edge_type(session, version_id=draft.id, name=e)
    await session.flush()
    await Versioner(store).activate(session, version_id=draft.id)
    await session.flush()
    return model


def _snap(graph_id, at, source, kind, name, count, source_id=None):
    return TypeCountSnapshot(
        graph_id=graph_id, at=at, source=source, source_id=source_id, kind=kind, type_name=name, count=count
    )


@pytest.mark.asyncio
class TestSnapshots:
    async def test_a_snapshot_counts_every_type_with_degrees(self, session, graph_id):
        if not NEO4J.is_up():
            pytest.skip(f"Neo4j is not running — {NEO4J.compose}")
        connector = NEO4J.connector()
        await connector.connect()
        try:
            written = await CountSnapshotManager().take(
                session, graph_id=graph_id, connector=connector, source="import", source_id=None, degrees=True
            )
        finally:
            await connector.disconnect()
        assert written > 0
        rows = (await session.execute(TypeCountSnapshot.__table__.select())).all()
        assert len({r.at for r in rows}) == 1
        assert any(r.kind == "node" and r.max_degree is not None for r in rows)

    async def test_a_snapshot_that_cannot_count_is_dropped_not_raised(self, session, graph_id):
        # Never connected: every read fails, and the act it follows must not.
        written = await CountSnapshotManager().take(
            session, graph_id=graph_id, connector=NEO4J.connector(), source="import", source_id=None, degrees=False
        )
        assert written == 0


def test_degree_is_reduced_from_a_histogram():
    assert degree_stats({1: 5, 2: 3, 900: 1}) == (900, 1)
    assert degree_stats({}) == (None, None)


@pytest.mark.asyncio
class TestGrowth:
    async def test_the_line_steps_where_something_wrote(self, session, store, graph_id):
        model = await _published(
            session, store, graph_id=graph_id, name="AirRoutes", nodes=["airport"], edges=["route"]
        )
        run = str(uuid.uuid4())
        session.add_all(
            [
                # Before the 7-day window: the opening value.
                _snap(graph_id, datetime(2026, 9, 1, tzinfo=UTC), "introspect", "node", "airport", 100),
                _snap(graph_id, datetime(2026, 9, 1, tzinfo=UTC), "introspect", "edge", "route", 10),
                # An import on day 3 of the window (23 Sep).
                _snap(graph_id, datetime(2026, 9, 23, 12, tzinfo=UTC), "import", "node", "airport", 130, run),
                _snap(graph_id, datetime(2026, 9, 23, 12, tzinfo=UTC), "import", "edge", "route", 40, run),
            ]
        )
        await session.flush()

        growth = (
            await InsightsManager().read(session, graph_id=graph_id, model_id=None, window="7d", today=TODAY)
        ).growth

        assert growth.labels[0] == "2026-09-21" and len(growth.labels) == 7
        assert growth.series[0].values == [110, 110, 170, 170, 170, 170, 170]
        assert [(m.index, m.source, m.source_id) for m in growth.marks] == [(2, "import", run)]
        row = growth.rows[0]
        assert (row.start, row.now, row.change) == (110, 170, 60)
        assert row.last.source_id == run
        assert growth.writes.imports == 1 and growth.counted

        one = (
            await InsightsManager().read(session, graph_id=graph_id, model_id=model.id, window="7d", today=TODAY)
        ).growth
        assert [s.key for s in one.series] == ["node:airport", "edge:route"]

    async def test_a_model_nothing_counted_is_never_imported(self, session, store, graph_id):
        model = await _published(session, store, graph_id=graph_id, name="Deals", nodes=["Deal"])

        growth = (
            await InsightsManager().read(session, graph_id=graph_id, model_id=model.id, window="30d", today=TODAY)
        ).growth

        assert not growth.counted
        assert growth.marks == [] and growth.rows[0].now is None
