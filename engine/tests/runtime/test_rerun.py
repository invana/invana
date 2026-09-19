"""Re-running a reply asks the query it produced — never the question that produced it.

A natural-language turn keeps the question on the user row and the generated
query on the reply (``source_query``). A re-run opens a ``ql-query`` run, which
has no translate step, so anything but the stored query reaches the driver as
the sentence the user typed.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from invana.apps.graphs.schemas import QueryResponse
from invana.apps.sessions.managers import SessionManager
from invana.apps.sessions.models import SessionMessage, SessionMessageRole, SessionMessageStatus
from invana.apps.sessions.querysets import SessionMessageQuerySet
from invana.runtime import catalogue as task_registry
from invana.runtime import services as run_services
from invana.runtime.catalogue import Out
from invana.runtime.interpreter import TaskRuntime
from invana.runtime.models import TaskRun
from invana.runtime.workflows import NL_QUERY

pytestmark = pytest.mark.asyncio

QUESTION = "whats longest airport"
CYPHER = "MATCH (a:Airport) RETURN a.code AS code ORDER BY a.longest_runway DESC LIMIT 1"


async def _answered_nl_turn(session, graph, user, *, source_query: str | None = CYPHER):
    """A settled NL turn: the question on the user row, the query it produced on the reply."""
    sess = await SessionManager().create_session(session, graph=graph, user_id=user.id, title="t")
    store = SessionMessageQuerySet()
    seq = await store.next_seq(session, session_id=sess.id)
    user_msg = SessionMessage(session_id=sess.id, seq=seq, role=SessionMessageRole.user, content=QUESTION)
    reply = SessionMessage(
        session_id=sess.id,
        seq=seq + 1,
        role=SessionMessageRole.assistant,
        content="Returned 1 row.",
        status=SessionMessageStatus.ok,
        mode="nl",
        query_language="cypher",
        source_query=source_query,
    )
    await store.add(session, user_msg)
    await store.add(session, reply)
    th = TaskRun(
        graph_id=graph.id,
        session_id=sess.id,
        message_id=user_msg.id,
        author_id=user.id,
        ask_kind="nl",
        body=QUESTION,
        params={"language": "cypher", "timeout_s": None},
        workflow_key=NL_QUERY.key,
        assistant_message_id=reply.id,
        status="succeeded",
    )
    session.add(th)
    await session.flush()
    reply.run_id = th.id
    sess.message_count = 2
    await session.flush()
    return sess, reply


class TestRerun:
    async def test_a_rerun_asks_the_stored_query(self, session, graph, user):
        sess, reply = await _answered_nl_turn(session, graph, user)

        th = await run_services.rerun_turn(session, sess=sess, graph=graph, message=reply, actor_id=user.id)

        assert th.ask_kind == "ql" and th.workflow_key == "ql-query"
        # The ask is the query the first run produced, not the sentence it translated.
        assert th.body == CYPHER
        assert reply.run_id == th.id and reply.status == SessionMessageStatus.running

    async def test_a_reply_with_no_query_cannot_be_rerun(self, session, graph, user):
        sess, reply = await _answered_nl_turn(session, graph, user, source_query=None)

        with pytest.raises(HTTPException) as err:
            await run_services.rerun_turn(session, sess=sess, graph=graph, message=reply, actor_id=user.id)

        assert err.value.status_code == 409 and err.value.detail["error"] == "no_source_query"

    async def test_the_query_that_runs_is_the_stored_one(self, session, session_factory, graph, user, monkeypatch):
        """End to end: what the driver is handed on a re-run of an NL turn."""
        asked: list[str] = []

        async def execute(ctx, v):
            asked.append(v.query)
            v.result = QueryResponse(
                result_type="tabular", query_language="cypher", rows=[{"code": "BPX"}], execution_time_ms=1, row_count=1
            )
            return Out(detail="1 row")

        async def project(ctx, v):
            return Out(detail="1 row → table")

        monkeypatch.setitem(task_registry.TASKS, "execute_graph_query", execute)
        monkeypatch.setitem(task_registry.TASKS, "shape_for_canvas", project)

        sess, reply = await _answered_nl_turn(session, graph, user)
        th = await run_services.rerun_turn(session, sess=sess, graph=graph, message=reply, actor_id=user.id)
        await session.commit()

        runtime = TaskRuntime(session_factory=session_factory, manager=object(), encryption_key="x")
        runtime.submit(th.id)
        await runtime._tasks[th.id]

        assert asked == [CYPHER]
