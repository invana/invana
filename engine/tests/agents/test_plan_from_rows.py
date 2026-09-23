"""The runtime executes the library, not a dict.

[the-library **LB12**](docs/for-developers/modules/workflows/features/the-library.md):
``select_plan`` reads ``task_plans`` + ``tasks``. Before it, ``plan_workflow``
resolved against ``TEMPLATES`` and the rows were something only Studio read — so
*a plan is its rows* was true for the library and false for execution, and
``TaskRun.task_id`` could not be populated from the runtime at all.

Two positives (the rows are the same plan, and a queued node names its row) and
two negatives (the envelope refuses, and an unmapped intent plans instead).
"""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.envelope import Envelope
from invana.apps.agents.registry import EXPLORER, TEMPLATES
from invana.apps.graphs.models import Graph
from invana.apps.task_plans.models import Task as PlanTask
from invana.runtime.models import RunStatus, TaskRun
from invana.runtime.planning import queue_plan_steps, resolve_plan, select_plan

pytestmark = pytest.mark.asyncio


def _envelope(**overrides) -> Envelope:
    return Envelope.from_spec({**EXPLORER.workflow_spec, **overrides}, budget={})


async def _root(session: AsyncSession, graph: Graph) -> TaskRun:
    row = TaskRun(graph_id=graph.id, ask_kind="nl", body="how many?", status=RunStatus.running.value)
    session.add(row)
    await session.flush()
    return row


class TestTheRowsAreThePlan:
    async def test_a_selected_plan_is_the_seeded_rows(self, session: AsyncSession, graph: Graph) -> None:
        """The steps that come back are the builtin's, and each names its row.

        Equality against ``TEMPLATES`` is the guard that matters: the registry
        is the seed source, so if exploding and rebuilding ever drifts, this is
        where a run silently starts executing a different plan.
        """
        selected = await select_plan(
            session, envelope=_envelope(), graph_id=graph.id, ask_kind="nl", intent_kind="single_query"
        )

        assert selected is not None
        assert (selected.key, selected.version, selected.ref) == ("nl-single", 2, "nl-single@2")

        authored = TEMPLATES["nl-single"].steps
        assert [s["task"] for s in selected.steps] == [s["task"] for s in authored]
        # Every `${args.N}` the plan declares is already resolved against its
        # default — a plan selected directly runs on what it declares, and a
        # marker that reached dispatch would be run as the literal string it is
        # (LB20).
        expected = [
            {k: (True if v == "${args.read_only}" else v) for k, v in dict(s["args"]).items()} for s in authored
        ]
        assert [s["args"] for s in selected.steps] == expected
        assert selected.declares == {
            "read_only": {"type": "bool", "default": True, "label": "Refuse anything that writes"}
        }

        # Every step carries the `tasks` row it was read from, and every one of
        # those rows belongs to the plan that was selected.
        rows = (
            (await session.execute(select(PlanTask.id).where(PlanTask.task_plan_id == selected.plan_id)))
            .scalars()
            .all()
        )
        assert {s["task_id"] for s in selected.steps} == set(rows)

    async def test_a_queued_node_names_the_row_it_runs(self, session: AsyncSession, graph: Graph) -> None:
        """``TaskRun.task_id`` is populated from the runtime — M3 left it null.

        This is the column the fan-in reads to answer *which node of which plan
        was this*, and nothing outside the library can fill it.
        """
        envelope = _envelope()
        selected = await select_plan(
            session, envelope=envelope, graph_id=graph.id, ask_kind="nl", intent_kind="single_query"
        )
        assert selected is not None
        steps, source = resolve_plan(
            envelope=envelope, raw_steps=[dict(s) for s in selected.steps], source=f"template:{selected.ref}"
        )
        assert source == "template:nl-single@2"

        root = await _root(session, graph)
        queued = await queue_plan_steps(session, run=root, message_id=None, steps=steps, start_seq=1)

        assert [row.task_id for row in queued] == [s["task_id"] for s in selected.steps]
        assert all(row.task_id is not None for row in queued)
        # The pin survives selection: a plan read from rows is still ceilinged.
        execute = next(row for row in queued if row.task_key == "execute_graph_query")
        assert execute.args["read_only"] is True


class TestWhenNoPlanIsSelected:
    async def test_the_envelope_refuses_a_plan_the_map_suggests(self, session: AsyncSession, graph: Graph) -> None:
        """The envelope permits, the map suggests, the Plan step selects.

        Returning the plan here would let an agent run a flow its envelope does
        not list, which is the one thing the envelope exists to stop.
        """
        selected = await select_plan(
            session,
            envelope=_envelope(templates=["ql-direct"]),
            graph_id=graph.id,
            ask_kind="nl",
            intent_kind="single_query",
        )
        assert selected is None

    async def test_an_unmapped_intent_falls_through_to_planning(self, session: AsyncSession, graph: Graph) -> None:
        """No match is *plan it with the model*, never an error.

        A graph whose library cannot serve an ask still answers it.
        """
        selected = await select_plan(
            session, envelope=_envelope(), graph_id=graph.id, ask_kind="nl", intent_kind="nothing_maps_to_this"
        )
        assert selected is None
