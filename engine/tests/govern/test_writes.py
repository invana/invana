"""A write is a governed crossing, addressed by the model version it lands in.

[GV35](docs/for-developers/modules/govern/spec.md) · load-data.md LD24 ·
stitch-models.md ST53. Real Postgres, no mocks; nothing here reaches a graph
database — the crossing is decided and recorded before and after the write.
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from invana.apps.govern.managers.touch import TouchManager
from invana.apps.graphs.models import Graph
from invana.apps.modeller.models import GraphModel, GraphVersion
from invana.runtime.catalogue.contract import CannotAnswer, RunVars, TaskContext, Writes
from invana.runtime.governing import Governor
from invana.runtime.models import TaskRun
from invana.runtime.stream import Emitter


async def _version(session: AsyncSession, graph: Graph, name: str) -> GraphVersion:
    model = GraphModel(graph_id=graph.id, name=name, description="", package_id=name.lower())
    session.add(model)
    await session.flush()
    version = GraphVersion(model_id=model.id, version="1.0.0", status="active")
    session.add(version)
    await session.flush()
    return version


async def _writes(session: AsyncSession, db_engine, graph: Graph, rules: list[dict]) -> tuple[Writes, TaskRun]:
    run = TaskRun(graph_id=graph.id, ask_kind="import", body="Import tweets", lens_snapshot={"rules": rules})
    session.add(run)
    await session.commit()
    ctx = TaskContext(
        db=session,
        manager=None,
        emitter=Emitter(async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False), run.id),
        step=run,
    )
    v = RunVars(
        graph=graph,
        sess=None,
        actor_id="",
        encryption_key="",
        user_message_id="",
        user_seq=0,
        assistant_message_id="",
        mode="import",
        prompt="",
        governor=Governor.for_run(run),
    )
    return Writes(ctx, v), run


async def test_a_stitch_touches_the_model_on_each_side(session: AsyncSession, db_engine, graph: Graph) -> None:
    """One ``out`` touch per version, carrying what landed in it (ST53)."""
    tweets, articles = await _version(session, graph, "Tweets"), await _version(session, graph, "Articles")
    writes, run = await _writes(session, db_engine, graph, rules=[])

    assert await writes.admit(tweets.id)
    assert await writes.admit(articles.id, fatal=False)
    writes.wrote(tweets.id, nodes=120, edges=40)
    writes.wrote(tweets.id, edges=7)
    writes.wrote(articles.id, edges=7)
    await writes.close()
    await session.commit()

    touched = {t.address: t for t in await TouchManager().for_run(session, run_id=run.id)}
    assert set(touched) == {"graph_data/model/Tweets@1.0.0", "graph_data/model/Articles@1.0.0"}
    assert touched["graph_data/model/Tweets@1.0.0"].direction == "out"
    assert touched["graph_data/model/Tweets@1.0.0"].volume == {"rows": 167, "nodes": 120, "edges": 47}
    assert touched["graph_data/model/Articles@1.0.0"].volume == {"rows": 7, "nodes": 0, "edges": 7}


async def test_a_refused_write_target_ends_the_run_before_anything_is_written(
    session: AsyncSession, db_engine, graph: Graph
) -> None:
    """The load's own model refused is *cannot answer*, naming the rule (GV29)."""
    tweets = await _version(session, graph, "Tweets")
    writes, run = await _writes(
        session, db_engine, graph, rules=[{"match": "graph_data/model/Tweets@*", "allow": False}]
    )

    with pytest.raises(CannotAnswer):
        await writes.admit(tweets.id)
    await session.commit()

    recorded = await TouchManager().for_run(session, run_id=run.id)
    assert [(t.direction, t.rule_matched) for t in recorded] == [("refused", "graph_data/model/Tweets@*")]


async def test_a_refused_counterpart_skips_only_that_stitch(session: AsyncSession, db_engine, graph: Graph) -> None:
    """The other side refused is struck in place; the load's own write stands."""
    tweets, deals = await _version(session, graph, "Tweets"), await _version(session, graph, "Deals")
    writes, run = await _writes(
        session, db_engine, graph, rules=[{"match": "graph_data/model/Deals@*", "allow": False}]
    )

    assert await writes.admit(tweets.id)
    assert not await writes.admit(deals.id, fatal=False)
    # Asked again by a second stitch over the same pair: one refusal, not two.
    assert not await writes.admit(deals.id, fatal=False)
    writes.wrote(tweets.id, nodes=3)
    await writes.close()
    await session.commit()

    recorded = await TouchManager().for_run(session, run_id=run.id)
    assert sorted((t.participant, t.direction) for t in recorded) == [
        ("Deals@1.0.0", "refused"),
        ("Tweets@1.0.0", "out"),
    ]
