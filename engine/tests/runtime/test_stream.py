"""The run_ask stream: persist-then-broadcast, replay from a cursor, terminal frames
(docs/for-developers/modules/ask/spec.md)."""

from __future__ import annotations

import asyncio
import json

import pytest

from invana.apps.sessions.managers import SessionManager
from invana.apps.sessions.schemas import SendMessage
from invana.runtime import services as run_services
from invana.runtime.stream import Emitter, replay, subscribe

pytestmark = pytest.mark.asyncio


async def _open(session, graph, user):
    sess = await SessionManager().create_session(session, graph=graph, user_id=user.id, title="t")
    _, _, th = await run_services.open_turn(
        session, sess=sess, graph=graph, payload=SendMessage(content="MATCH (n) RETURN n", mode="ql"), actor_id=user.id
    )
    await session.commit()
    return th


async def test_emit_persists_in_order_and_replays_after_a_cursor(session, session_factory, graph, user):
    th = await _open(session, graph, user)
    emitter = Emitter(session_factory, th.id)
    for i in range(3):
        await emitter.emit("step.progress", {"i": i})
    rows = await replay(session, run_id=th.id, after=1)
    assert [r.seq for r in rows] == [2, 3]
    assert rows[0].payload == {"i": 1}


async def test_subscribe_replays_then_tails_until_terminal(session, session_factory, graph, user):
    th = await _open(session, graph, user)
    emitter = Emitter(session_factory, th.id)
    await emitter.emit("run.started", {})

    async def produce():
        await asyncio.sleep(0.05)
        await emitter.emit("step.started", {"seq": 0})
        await emitter.emit("run.done", {"status": "succeeded"})

    producer = asyncio.create_task(produce())
    frames = []
    async for frame in subscribe(session_factory, run_id=th.id, after=0):
        if frame.startswith("id:"):
            frames.append(json.loads(frame.split("data: ", 1)[1].strip()))
    await producer
    assert [f["kind"] for f in frames] == ["run.started", "step.started", "run.done"]
    assert [f["seq"] for f in frames] == [1, 2, 3]
