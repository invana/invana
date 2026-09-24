"""The journal — every run in the Graph, newest first (inspect-what-landed.md IW7).

**One journal, filtered by kind** (SR23 · § 6.7). A load, a bulk load and an ask
are all TaskRuns, so *what changed my graph* is `?kind=import` rather than a
surface of its own. What is under test is the ordering, the filter and the Graph
boundary, none of which need a graph database to be true.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio

from invana.apps.graphs.models import Graph
from invana.core.auth.models import User
from invana.runtime import services
from invana.runtime.models import TaskRun


async def _graph(session, name: str) -> Graph:
    user = User(
        username=f"owner{uuid.uuid4().hex[:6]}",
        email=f"{uuid.uuid4().hex[:8]}@invana.test",
        password_hash="x",
        first_name="Owner",
    )
    session.add(user)
    await session.flush()
    graph = Graph(name=name, slug=f"{name}-{uuid.uuid4().hex[:6]}", created_by_id=user.id)
    session.add(graph)
    await session.flush()
    return graph


async def _run(session, graph: Graph, *, kind: str, body: str, minutes_ago: int, status: str = "succeeded") -> TaskRun:
    run = TaskRun(
        graph_id=graph.id,
        ask_kind=kind,
        body=body,
        status=status,
        author_kind="system",
        queued_at=datetime.now(UTC) - timedelta(minutes=minutes_ago),
    )
    session.add(run)
    await session.flush()
    return run


@pytest_asyncio.fixture
async def journal(session):
    """Three kinds of run in one Graph, and one in a different Graph."""
    graph = await _graph(session, "finance")
    await _run(session, graph, kind="import", body="Import news-tv", minutes_ago=30)
    await _run(session, graph, kind="ask", body="Which airlines?", minutes_ago=20, status="failed")
    await _run(session, graph, kind="bulk", body="Bulk load market-bars", minutes_ago=10, status="running")

    other = await _graph(session, "ops")
    stray = await _run(session, other, kind="import", body="Import logs", minutes_ago=5)
    return graph, stray


@pytest.mark.asyncio
class TestJournal:
    async def test_every_run_newest_first_whatever_kind_it_is(self, session, journal):
        graph, _ = journal

        items, total = await services.list_runs(session, graph_id=graph.id, limit=50)

        # Filtered, not selective: an ask is in the same list as a load (SR23).
        assert [i["kind"] for i in items] == ["bulk", "ask", "import"]
        assert items[0]["body"] == "Bulk load market-bars"
        assert total == 3

    async def test_kind_narrows_to_one_kind_of_work(self, session, journal):
        graph, _ = journal

        items, _ = await services.list_runs(session, graph_id=graph.id, kind="import", limit=50)

        assert [i["body"] for i in items] == ["Import news-tv"]

    async def test_a_runs_steps_are_not_rows_of_their_own(self, session, journal):
        """SR43 — the journal lists roots; a step is read through its run.

        This held only while a `kind` was named: `ask_kind` is null on a child,
        so that filter excluded children as a side effect. The drawer names no
        kind, so it listed every step row in the Graph.
        """
        graph, _ = journal
        root = await _run(session, graph, kind="ask", body="Which routes?", minutes_ago=1)
        for seq, task_key in enumerate(("understand_intent", "translate_thought", "execute_graph_query")):
            session.add(
                TaskRun(
                    graph_id=graph.id,
                    parent_run_id=root.id,
                    seq=seq,
                    task_key=task_key,
                    status="succeeded",
                    author_kind="system",
                    queued_at=datetime.now(UTC),
                )
            )
        await session.flush()

        items, total = await services.list_runs(session, graph_id=graph.id, limit=50)

        ids = {i["id"] for i in items}
        assert root.id in ids
        assert total == 4, "the three steps are not four more rows"
        assert all(i["body"] for i in items), "a step has no body; a journal row does"
        # The run still says how many steps it has — read off the row, not listed beside it.
        assert next(i for i in items if i["id"] == root.id)["step_count"] == 3

    async def test_a_row_says_what_the_run_spent_and_when_it_began(self, session, journal):
        """SR45 — the journal row's second line, without a trace fetch per row."""
        graph, _ = journal
        root = await _run(session, graph, kind="ask", body="Which routes?", minutes_ago=1)
        root.started_at = datetime.now(UTC) - timedelta(seconds=40)
        for seq, (tokens_in, tokens_out) in enumerate(((1200, 300), (4000, 900))):
            session.add(
                TaskRun(
                    graph_id=graph.id,
                    parent_run_id=root.id,
                    seq=seq,
                    task_key=f"step_{seq}",
                    status="succeeded",
                    author_kind="system",
                    queued_at=datetime.now(UTC),
                    tokens_in=tokens_in,
                    tokens_out=tokens_out,
                )
            )
        await session.flush()

        items, _ = await services.list_runs(session, graph_id=graph.id, limit=50)

        row = next(i for i in items if i["id"] == root.id)
        assert (row["tokens_in"], row["tokens_out"]) == (5200, 1200), "summed over the run's tasks"
        assert row["started_at"] is not None, "elapsed is measured from it"
        # A load spends no tokens, and its row says so rather than picking up
        # a sibling's roll-up.
        load = next(i for i in items if i["body"] == "Import news-tv")
        assert (load["tokens_in"], load["tokens_out"]) == (0, 0)

    async def test_another_graphs_run_is_not_in_this_journal(self, session, journal):
        graph, stray = journal

        items, _ = await services.list_runs(session, graph_id=graph.id, limit=50)

        # A scoping refusal reads as absent, never as forbidden.
        assert stray.id not in {i["id"] for i in items}


@pytest.mark.asyncio
class TestBulkLoad:
    """The fast path is a run like any other, and the kind is what says it validated nothing.

    Writing the CSV is `CSVLoader`, covered in `tests/graph/loaders`. What is
    under test here is the declaration the plan rests on — an edit that gave
    `bulk_write` a `requires` would make a bulk load claim a validation it never
    ran, and nothing else would notice.
    """

    async def test_bulk_write_requires_nothing(self, session):
        from invana.runtime.catalogue import CATALOGUE

        entry = CATALOGUE["bulk_write"]
        assert entry.bound.value == "graph_write"
        # Borrowing `write_graph`'s `requires: validate_records` is the whole
        # thing this guards against (LD10 · § 6.1).
        assert entry.requires == ()

    async def test_the_bulk_plan_is_one_step_and_says_which_kind_it_is(self, session):
        from invana.apps.agents.registry import TEMPLATES

        plan = TEMPLATES["bulk-load"]
        assert plan.kind == "bulk"
        assert [s["task"] for s in plan.steps] == ["bulk_write"]

    async def test_the_step_is_handed_the_folder_it_loads(self, session, tmp_path):
        """`bulk_write` reads its step's args; a folder only on the run's params is no folder."""
        from invana.runtime.querysets import TaskRunQuerySet

        graph = await _graph(session, "bulk")
        run = await services.open_bulk_run(session, graph=graph, path=str(tmp_path), batch_size=50)

        [step] = await TaskRunQuerySet().nodes_of(session, run_id=run.id)
        assert step.task_key == "bulk_write"
        assert step.args["root"] == str(tmp_path.resolve())
        assert step.args["batch_size"] == 50
