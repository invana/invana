"""The query log, and what Usage and Performance read off it.

From the-model-page.md: the caller is read off the run (MP35); a query is
handed to the log after it answers, never failing it (MP36); a shape is its
text without literals (MP37) and is explained once (MP38); signals follow the
fixed rules, and not below 50 queries (MP10); advice names the model that
declares the label (MP39). Real databases only — every Neo4j query here reads.
"""

import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
import pytest_asyncio
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from invana.apps.graphs.models import Graph
from invana.apps.modeller.managers import InsightsManager, QueryLogWriter
from invana.apps.modeller.models import GraphQueryLog, TypeCountSnapshot
from invana.apps.modeller.query_shapes import shape_of
from invana.apps.modeller.versioner import Versioner
from invana.core.auth.models import User
from invana.core.querylog import ObservedQuery, QueryCaller, calling_as, observe, set_query_observer
from invana.core.telemetry import spans
from invana.runtime.callers import classify
from invana.runtime.models import TaskRun
from tests.graph.connectors.backends import NEO4J

TODAY = date(2026, 9, 27)
NOON = datetime(2026, 9, 26, 12, tzinfo=UTC)


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
    await session.commit()
    return graph.id


@pytest_asyncio.fixture
async def neo4j():
    if not NEO4J.is_up():
        pytest.skip(f"Neo4j is not running — {NEO4J.compose}")
    connector = NEO4J.connector()
    await connector.connect()
    yield connector
    await connector.disconnect()


def test_the_caller_is_read_off_the_run():
    def run(**kw):
        return TaskRun(graph_id="g", id="r", triggered_by=kw.pop("triggered_by", "user"), **kw)

    assert classify(run(triggered_by="canvas")).kind == "explorer"
    assert classify(run(ask_kind="nl")).kind == "agent"
    assert classify(run(ask_kind="ql")).kind == "api"
    # A typed query is the person's, even through the agent every session binds.
    assert classify(run(ask_kind="ql", agent_id="explorer")).kind == "api"
    assert classify(run(agent_id="explorer")).kind == "agent"
    assert classify(run(workflow_key="route-planner@2")).kind == "plan"
    # Writes and the platform's own runs ask for no one.
    assert classify(run(workflow_key="model-import@1")) is None
    assert classify(run(triggered_by="system")) is None


def test_a_shape_takes_the_literals_out():
    a = shape_of("MATCH (a:airport {code: 'AUS'})-[:route*1..3]->(b) RETURN b LIMIT 10")
    b = shape_of('MATCH (a:airport {code: "LHR"})-[:route*1..3]->(b)  RETURN b LIMIT 25')
    assert a == b
    assert a[1] == "MATCH (a:airport {code: $p0})-[:route*1..3]->(b) RETURN b LIMIT $p1"


@pytest.mark.asyncio
async def test_a_query_is_observed_only_when_someone_asked(neo4j):
    seen: list[ObservedQuery] = []
    set_query_observer(seen.append)
    try:
        await neo4j.execute("MATCH (a:airport) RETURN a LIMIT 1")
        with calling_as(QueryCaller(graph_id="g", kind="explorer")):
            await neo4j.execute("MATCH (a:airport) RETURN a LIMIT 1")
    finally:
        set_query_observer(None)
    assert len(seen) == 1
    assert seen[0].caller.kind == "explorer" and seen[0].ok and seen[0].node_labels == {"airport"}


@pytest.mark.asyncio
async def test_the_writer_explains_a_shape_once_and_drops_what_it_cannot_hold(
    session_factory, session, graph_id, neo4j
):
    async def connector_for(_):
        return neo4j

    writer = QueryLogWriter(session_factory, connector_for, maxsize=2)
    caller = QueryCaller(graph_id=graph_id, kind="agent", caller_id="ops-desk")
    for city in ("Austin", "Paris", "Lima"):
        writer.submit(
            ObservedQuery(
                caller=caller,
                query=f"MATCH (a:airport) WHERE a.city = '{city}' RETURN a",
                parameters={},
                language="cypher",
                duration_ms=12.0,
                rows=1,
                ok=True,
            )
        )
    assert writer.dropped == 1
    await writer.drain()

    rows = (await session.execute(GraphQueryLog.__table__.select())).all()
    assert len(rows) == 2 and len({r.shape_hash for r in rows}) == 1
    assert all(r.touched_from == "plan" for r in rows)
    first, second = sorted(rows, key=lambda r: r.at)
    assert "airport.city" in first.properties_touched["scanned"]
    assert first.properties_touched.get("plan") and "plan" not in second.properties_touched


@pytest.mark.asyncio
async def test_a_logged_query_is_written_in_its_own_trace_linked_to_where_it_was_asked(
    session_factory, session, graph_id, monkeypatch
):
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    monkeypatch.setattr(spans._trace, "get_tracer", lambda *a, **k: provider.get_tracer("test"))

    async def connector_for(_):
        return None

    writer = QueryLogWriter(session_factory, connector_for)
    set_query_observer(writer.submit)
    try:
        with spans.span("request") as request, calling_as(QueryCaller(graph_id=graph_id, kind="api")):
            observe(
                lambda caller: ObservedQuery(
                    caller=caller,
                    query="MATCH (a:airport) RETURN a",
                    parameters={},
                    language="cypher",
                    duration_ms=4.0,
                    rows=1,
                    ok=True,
                )
            )
    finally:
        set_query_observer(None)
    await writer.drain()

    rows = (await session.execute(GraphQueryLog.__table__.select())).all()
    assert len(rows) == 1
    (write,) = [s for s in exporter.get_finished_spans() if s.name == "system.query_log"]
    asked = request.get_span_context()
    assert write.parent is None and write.context.trace_id != asked.trace_id
    assert write.attributes["invana.origin"] == "daemon" and write.attributes["invana.query_log.batch"] == 1
    assert [link.context.span_id for link in write.links] == [asked.span_id]


async def _published(session, store, graph_id, name, nodes):
    model = await store.create_graph_model(session, name=name, graph_id=graph_id)
    draft = await store.create_version(session, model_id=model.id)
    for n in nodes:
        await store.create_node_type(session, version_id=draft.id, name=n)
    await session.flush()
    await Versioner(store).activate(session, version_id=draft.id)
    await session.flush()
    return model


def _logged(graph_id, n, *, nodes, ms=10.0, scanned=(), shape="MATCH (a:airport) RETURN a"):
    shape_hash, text = shape_of(shape)
    return [
        GraphQueryLog(
            graph_id=graph_id,
            at=NOON - timedelta(minutes=i),
            shape_hash=shape_hash,
            shape_text=text,
            language="cypher",
            caller_kind="agent",
            duration_ms=ms,
            rows=1,
            ok=True,
            types_touched={"nodes": nodes, "edges": []},
            properties_touched={"filtered": list(scanned), "scanned": list(scanned), "plan": ["NodeByLabelScan"]},
            touched_from="plan",
        )
        for i in range(n)
    ]


@pytest.mark.asyncio
class TestInsights:
    async def test_signals_follow_the_fixed_rules(self, session, store, graph_id):
        model = await _published(session, store, graph_id, "AirRoutes", ["airport", "version", "gate"])
        session.add_all(
            [
                *_logged(graph_id, 40, nodes=["airport"], ms=900, scanned=["airport.city"]),
                *_logged(graph_id, 20, nodes=["country"], ms=10, shape="MATCH (c:country) RETURN c"),
                TypeCountSnapshot(
                    graph_id=graph_id, at=NOON, source="import", kind="node", type_name="airport", count=3504
                ),
                TypeCountSnapshot(
                    graph_id=graph_id, at=NOON, source="import", kind="node", type_name="version", count=1
                ),
            ]
        )
        await session.flush()

        read = await InsightsManager().read(session, graph_id=graph_id, model_id=model.id, window="7d", today=TODAY)

        signals = {(s.subject, s.signal) for r in read.usage.rows for s in r.signals}
        assert ("airport", "hot_and_slow") in signals
        assert ("version", "unused") in signals and ("gate", "empty") in signals
        assert not read.usage.too_few and read.usage.callers["agent"] == 40

        shape = read.performance.shapes[0]
        assert shape.calls == 40 and shape.has_advice
        card = await InsightsManager().shape(
            session, graph_id=graph_id, shape_hash=shape.hash, window="7d", connector=None, today=TODAY
        )
        assert [(a.label, a.property, a.model_name) for a in card.advice] == [("airport", "city", "AirRoutes")]

    async def test_too_few_queries_call_nothing(self, session, store, graph_id):
        await _published(session, store, graph_id, "AirRoutes", ["airport", "version"])
        session.add_all(_logged(graph_id, 31, nodes=["airport"]))
        await session.flush()

        read = await InsightsManager().read(session, graph_id=graph_id, model_id=None, window="7d", today=TODAY)

        assert read.usage.too_few and read.usage.total == 31
        assert all(not r.signals for r in read.usage.rows)
        assert read.overview.attention == []
