"""Emissions are records (the-answer-surface.md AS10).

The claims worth a test: the producing step declares the kind (AS2), every
emission cites (AS3), and zero records comes back as the empty answer rather than
as a blank table (AS7).
"""

import uuid
from dataclasses import dataclass

import pytest
import pytest_asyncio

from invana.apps.graphs.models import Graph
from invana.core.auth.models import User
from invana.runtime.emissions import list_for_run, produce
from invana.runtime.models import TaskRun
from invana.runtime.projections import ensure_builtins


@dataclass
class FakeResult:
    result_type: str
    row_count: int
    rows: list | None = None
    data: object | None = None
    query_language: str = "cypher"
    execution_time_ms: int = 7


@pytest_asyncio.fixture
async def scope(session):
    """A Graph, a run_ask and a run for emissions to hang off."""
    user = User(
        username=f"owner{uuid.uuid4().hex[:6]}",
        email=f"{uuid.uuid4().hex[:8]}@invana.test",
        password_hash="x",
        first_name="Owner",
    )
    session.add(user)
    await session.flush()
    graph = Graph(name="finance", slug=f"finance-{uuid.uuid4().hex[:6]}", created_by_id=user.id)
    session.add(graph)
    await session.flush()
    # The ask is the run's own columns now — one row, not two.
    run = TaskRun(graph_id=graph.id, ask_kind="nl", body="how many stocks?", workflow_key="nl-query")
    session.add(run)
    await session.flush()
    await ensure_builtins(session)
    return graph, run


@pytest.mark.asyncio
class TestProduce:
    async def test_one_number_becomes_a_metric_that_cites(self, session, scope):
        graph, run = scope
        result = FakeResult(result_type="tabular", row_count=1, rows=[{"total": 512}])

        emission, offers, _ = await produce(
            session,
            run_id=run.id,
            graph_id=graph.id,
            result=result,
            query="MATCH (s:Stock) RETURN count(s) AS total",
        )

        assert emission.kind == "metric"
        assert emission.payload["value"] == "512"
        # The citation is not optional: the query and the record count travel
        # with the emission (AS3).
        assert emission.citation["record_count"] == 1
        assert emission.citation["query"].startswith("MATCH")
        # A template chose this, so the header can name it (AS9).
        assert emission.template_id is not None
        assert any(o["name"] == "category-bars" and not o["available"] for o in offers)

    async def test_zero_records_is_the_empty_answer_not_a_blank_table(self, session, scope):
        graph, run = scope
        result = FakeResult(result_type="tabular", row_count=0, rows=[])

        emission, _, _ = await produce(
            session,
            run_id=run.id,
            graph_id=graph.id,
            result=result,
            query="MATCH (s:Stock) RETURN s",
        )

        assert emission.kind == "empty"
        assert "does not hold" in emission.payload["statement"]

    async def test_emissions_are_rows_so_an_answer_survives_a_reload(self, session, scope):
        graph, run = scope
        for i in range(2):
            await produce(
                session,
                run_id=run.id,
                graph_id=graph.id,
                result=FakeResult(result_type="tabular", row_count=2, rows=[{"a": i}, {"a": i + 1}]),
                query="MATCH (n) RETURN n.a AS a",
            )
        await session.commit()

        rows = await list_for_run(session, run.id)
        assert [row.seq for row in rows] == [0, 1]
        assert all(row.kind == "table" for row in rows)
