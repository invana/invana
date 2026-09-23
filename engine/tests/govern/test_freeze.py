"""What a run is dispatched under, frozen at open.

``effective = agent ∩ plan ∩ todo`` is composed **once** and written onto the
run (GV6 · GV8). These tests exist because the composition is correct in
`apps/govern` and was, until now, reaching no run at all: `lens_id` and
`lens_snapshot` were columns nobody wrote, so *This run's lens* had nothing to
read and every past answer was equally unreconstructible.

Real Postgres, no mocks.
"""

from __future__ import annotations

import pytest

from invana.apps.agents.managers import AgentManager
from invana.apps.agents.schemas import AgentCreate
from invana.apps.govern.catalogue import Catalogue
from invana.apps.govern.managers import LensManager
from invana.apps.govern.models import LensKind
from invana.apps.govern.schemas import LensCreate, LensUpdate, RuleIn
from invana.core.errors import NotFoundError
from invana.runtime.services import freeze_lens

pytestmark = pytest.mark.asyncio

lenses = LensManager()
EMPTY = Catalogue(participants=())


async def _guardrail(session, graph, user):
    return await lenses.create(
        session,
        graph_id=graph.id,
        payload=LensCreate(
            name="Graph guardrails",
            kind=LensKind.guardrail,
            scope="graph",
            rules=[RuleIn(match="third_party/**", allow=False)],
        ),
        actor_id=user.id,
        catalogue=EMPTY,
        may_edit_guardrails=True,
    )


class TestFreezingTheLens:
    async def test_no_world_still_freezes_the_guardrails(self, session, graph, user, member):
        """**No world is the widest, not the narrowest** (GV7).

        A guardrail is in force on every run whatever world it is asked under,
        so it is frozen whether or not somebody picked one.
        """
        await _guardrail(session, graph, user)

        frozen = await freeze_lens(session, graph_id=graph.id, agent_id=None, lens_id=None)

        assert frozen["lens_id"] is None
        assert [r["match"] for r in frozen["lens_snapshot"]["rules"]] == ["third_party/**"]

    async def test_a_picked_world_composes_inside_the_ceiling(self, session, graph, user, member):
        """Both contributors are in the snapshot, and it is one document (GV1)."""
        await _guardrail(session, graph, user)
        world = await lenses.create(
            session,
            graph_id=graph.id,
            payload=LensCreate(
                name="EU · H1 2026",
                rules=[RuleIn(match="graph_data/model/Routes@*", allow=True)],
                closed_layers=["graph_data"],
            ),
            actor_id=user.id,
            catalogue=EMPTY,
            may_edit_guardrails=True,
        )

        frozen = await freeze_lens(session, graph_id=graph.id, agent_id=None, lens_id=world.id)

        snapshot = frozen["lens_snapshot"]
        assert frozen["lens_id"] == world.id
        assert sorted(r["match"] for r in snapshot["rules"]) == [
            "graph_data/model/Routes@*",
            "third_party/**",
        ]
        assert snapshot["closed_layers"] == ["graph_data"]
        # The name travels with it, so a rename later cannot rewrite what a past
        # run says it ran under (GR3).
        assert {c["name"] for c in snapshot["contributors"]} == {"Graph guardrails", "EU · H1 2026"}

    async def test_a_rename_does_not_reach_a_run_that_already_opened(self, session, graph, user, member):
        """GR3 — the snapshot is the record, and the row is not."""
        world = await lenses.create(
            session,
            graph_id=graph.id,
            payload=LensCreate(name="EU · H1 2026"),
            actor_id=user.id,
            catalogue=EMPTY,
            may_edit_guardrails=True,
        )
        frozen = await freeze_lens(session, graph_id=graph.id, agent_id=None, lens_id=world.id)

        await lenses.update(
            session,
            lens=world,
            payload=LensUpdate(name="Europe, first half"),
            actor_id=user.id,
            catalogue=EMPTY,
            may_edit_guardrails=True,
        )

        assert frozen["lens_snapshot"]["contributors"][0]["name"] == "EU · H1 2026"

    async def test_a_world_from_another_graph_refuses_before_the_run_is_written(self, session, graph, user, member):
        """A run that opened under nothing while its asker believed otherwise is
        the one outcome this module exists to prevent."""
        with pytest.raises(NotFoundError):
            await freeze_lens(session, graph_id=graph.id, agent_id=None, lens_id="00000000-0000-0000-0000-000000000000")

    async def test_the_agents_own_world_composes_even_when_nobody_picked_one(self, session, graph, user, member):
        """The third bound is in force on every run this agent opens (AG2).

        A world that only narrowed the runs somebody remembered to pick it for
        would not be a bound — and a child carries its parent's (DG9), so this
        is also how the narrowing travels down the tree.
        """
        own = await lenses.create(
            session,
            graph_id=graph.id,
            payload=LensCreate(
                name="Price-blind",
                rules=[RuleIn(match="graph_data/model/Deal@*", allow=True)],
            ),
            actor_id=user.id,
            catalogue=EMPTY,
            may_edit_guardrails=True,
        )
        agent = await AgentManager().create_agent(
            session,
            graph=graph,
            payload=AgentCreate(name="Analyst", lens_id=own.id),
            actor=user,
        )

        frozen = await freeze_lens(session, graph_id=graph.id, agent_id=agent.id, lens_id=None)

        # `lens_id` still reads the world the *asker* picked, which is none.
        assert frozen["lens_id"] is None
        assert [r["match"] for r in frozen["lens_snapshot"]["rules"]] == ["graph_data/model/Deal@*"]
        assert {c["name"] for c in frozen["lens_snapshot"]["contributors"]} == {"Price-blind"}
