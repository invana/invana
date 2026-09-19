"""Where a model's records were loaded from (task-model-migration § 6.7 · ST51).

A stitch whose endpoints are rows reads them back off disk, and the folder is a
fact about a **load**, not about the model. So it is read off the run that did
the loading — there is no row anywhere that stores it a second time.
"""

import uuid

import pytest

from invana.apps.graphs.models import Graph
from invana.core.auth.models import User
from invana.runtime.models import TaskRun
from invana.runtime.querysets import TaskRunQuerySet

_runs = TaskRunQuerySet()


async def _graph(session) -> Graph:
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
    return graph


def _load_run(graph: Graph, *, model_id: str, root: str) -> TaskRun:
    return TaskRun(
        graph_id=graph.id,
        ask_kind="import",
        body=f"Import into {model_id}",
        params={"root": root, "model_id": model_id, "model": "NewsArticles"},
        author_kind="system",
    )


@pytest.mark.asyncio
class TestTheFolderComesOffTheRun:
    async def test_the_newest_load_of_that_model_names_the_folder(self, session):
        graph = await _graph(session)
        session.add(_load_run(graph, model_id="m-news", root="/data/news-v1"))
        await session.flush()
        session.add(_load_run(graph, model_id="m-news", root="/data/news-v2"))
        await session.flush()

        # Re-loading the same model from somewhere else moves where its rows are
        # read from, which is the whole reason this is not stored on the model.
        assert await _runs.latest_load_root(session, model_id="m-news") == "/data/news-v2"

    async def test_a_model_nothing_has_loaded_names_nothing(self, session):
        graph = await _graph(session)
        session.add(_load_run(graph, model_id="m-news", root="/data/news"))
        await session.flush()

        # Not a failure: a stitch declared before its records arrive is an
        # ordinary staged rule, and the commit says so rather than raising.
        assert await _runs.latest_load_root(session, model_id="m-twitter") is None
