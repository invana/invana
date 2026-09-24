"""An expansion is a run, and the session's turn is that run (GC6 · GC11 · GC12).

What is under test is the record: the plan it opens, the trigger that keeps it
out of the journal, and the reply it settles into. Real Postgres, no mocks, no
graph database — reading under the lens is the connector suite's
(`tests/graph/connectors/neighbour_lens.py`, every live backend).
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.explorer.schemas import ExpandByEdgeTypeRequest
from invana.apps.graphs.models import Graph
from invana.apps.sessions.models import Session, SessionMessage
from invana.core.auth.models import User
from invana.runtime import services
from invana.runtime.canvas import _explore, open_expand_run
from invana.runtime.models import TriggeredBy
from invana.runtime.querysets import TaskRunQuerySet


async def _session(db: AsyncSession, graph: Graph, owner: User) -> Session:
    sess = Session(graph_id=graph.id, created_by_id=owner.id)
    db.add(sess)
    await db.flush()
    return sess


async def test_an_expansion_is_a_canvas_run_and_the_turn_is_the_run(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    sess = await _session(session, graph, user)
    req = ExpandByEdgeTypeRequest(vertex_id="v1", edge_label="KNOWS", session_id=sess.id)

    run = await open_expand_run(session, graph=graph, actor_id=user.id, req=req, sess=sess)

    assert run.workflow_key == "expand-neighbours@1"
    assert run.triggered_by == TriggeredBy.canvas.value
    assert run.lens_snapshot is not None
    # The session's agent narrows the lens; it does not perform the run (GC11).
    assert run.agent_id is None
    [step] = await TaskRunQuerySet().nodes_of(session, run_id=run.id)
    assert (step.task_key, step.args["edge_label"], step.args["vertex_id"]) == ("expand_neighbours", "KNOWS", "v1")

    # The step is queued under the reply, which is what the Tasks tab lists.
    reply = await session.get(SessionMessage, run.assistant_message_id)
    assert reply is not None and reply.run_id == run.id and reply.operation == "expand"
    listed = await services.steps_for_messages(session, [reply])
    assert [s.id for s in listed[reply.id]] == [step.id]

    # Off the journal by default; on when asked for (GC7).
    hidden, _ = await services.list_runs(session, graph_id=graph.id)
    shown, _ = await services.list_runs(session, graph_id=graph.id, interactive=True)
    assert run.id not in {r["id"] for r in hidden}
    assert run.id in {r["id"] for r in shown}


async def test_a_session_somebody_else_owns_gets_no_turn(
    session: AsyncSession, graph: Graph, user: User, other_user: User
) -> None:
    theirs = await _session(session, graph, other_user)

    owned = await _explore.owned_session(session, graph=graph, actor_id=user.id, session_id=theirs.id)

    assert owned is None
