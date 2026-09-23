"""What a guardrail save would cost, and what a run actually did.

Two surfaces, one idea: a bound whose effect is invisible is a bound taken on
trust. `assess` says what a proposal costs *before* the write; the touches say
what a run did *after* it ran, and the difference between them is what a person
reads when they retune.
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.govern.addressing import Layer
from invana.apps.govern.catalogue import Catalogue, Participant
from invana.apps.govern.impact import assess
from invana.apps.govern.managers import TouchManager
from invana.apps.govern.models import TouchDirection
from invana.apps.govern.rules import Effective, Rule
from invana.apps.graphs.models import Graph
from invana.core.auth.models import User
from invana.runtime.models import TaskRun

touches = TouchManager()

_CATALOGUE = Catalogue(
    participants=(
        Participant(
            address="graph_data/model/Routes@v4",
            layer=Layer.graph_data,
            sublayer="model",
            name="Routes@v4",
            label="Routes@v4",
        ),
        Participant(
            address="third_party/api/clearbit.com/v2/companies",
            layer=Layer.third_party,
            sublayer="api",
            name="clearbit.com/v2/companies",
            label="clearbit",
        ),
        Participant(
            address="llm/anthropic-prod/claude-opus-5",
            layer=Layer.llm,
            sublayer="anthropic-prod",
            name="claude-opus-5",
            label="claude-opus-5",
        ),
    )
)


# ── what a save would cost ───────────────────────────────────────────────────


def test_a_save_names_the_worlds_it_narrows_and_the_ones_it_does_not() -> None:
    """GR2 — *Saving this would change 2 of 4 worlds*, before the write."""
    everything = Effective()
    already_tight = Effective(rules=[Rule(match="third_party/**", allow=False)])

    impact = assess(
        proposed=Effective(rules=[Rule(match="third_party/**", allow=False)]),
        current=Effective(),
        worlds=[("w1", "Everything", everything), ("w2", "Nothing leaves", already_tight)],
        catalogue=_CATALOGUE,
    )

    assert impact.headline == "Saving this would change 1 of 2 worlds."
    by_name = {world.name: world for world in impact.worlds}

    assert by_name["Everything"].loses == ("third_party/api/clearbit.com/v2/companies",)
    assert "loses" in by_name["Everything"].summary
    # A world already inside the rule is not "changed" — nothing about it moves.
    assert not by_name["Nothing leaves"].changes
    assert by_name["Nothing leaves"].summary == "loses nothing — already inside every rule"


def test_a_proposal_that_denies_a_worlds_cast_says_so_louder() -> None:
    """Losing a model is one thing; a world that can no longer run is another."""
    world = Effective(cast={"decide": "llm/anthropic-prod/claude-opus-5"})
    impact = assess(
        proposed=Effective(rules=[Rule(match="llm/anthropic-prod/**", allow=False)]),
        current=Effective(),
        worlds=[("w1", "EU · H1 2026", world)],
        catalogue=_CATALOGUE,
    )
    assert impact.worlds[0].cast_denied == ("decide",)
    assert "its decide cast is denied" in impact.worlds[0].summary


def test_a_proposal_that_changes_nothing_says_that_too() -> None:
    """GR6 — *nothing set* and *nothing permitted* must never look alike."""
    impact = assess(
        proposed=Effective(),
        current=Effective(),
        worlds=[("w1", "Everything", Effective())],
        catalogue=_CATALOGUE,
    )
    assert impact.headline == "No change to any of 1 worlds."
    assert impact.changed == []


# ── what a run did ───────────────────────────────────────────────────────────


async def _run(session: AsyncSession, graph: Graph, user: User) -> TaskRun:
    run = TaskRun(graph_id=graph.id, author_id=user.id, body="which carriers grew fastest?")
    session.add(run)
    await session.flush()
    return run


@pytest.mark.asyncio
async def test_a_refusal_is_recorded_in_place_with_the_rule_that_caused_it(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """R1 — refusals are struck in place, never filtered out."""
    run = await _run(session, graph, user)
    lens = Effective(rules=[Rule(match="third_party/**", allow=False)])
    address = "third_party/api/clearbit.com/v2/companies"

    await touches.record(
        session,
        run_id=run.id,
        graph_id=graph.id,
        seq=1,
        address="graph_data/model/Routes@v4",
        direction=TouchDirection.out,
        step_key="execute_query",
        volume={"rows": 1284},
    )
    await touches.record(
        session,
        run_id=run.id,
        graph_id=graph.id,
        seq=2,
        address=address,
        direction=TouchDirection.refused,
        verdict=lens.decide(address),
    )

    recorded = await touches.for_run(session, run_id=run.id)
    assert [touch.seq for touch in recorded] == [1, 2], "in seq order, refusal included"
    assert recorded[1].rule_matched == "third_party/**"
    assert recorded[1].why == "denied by third_party/**"
    # WO19 — `rows` is the only count; there is no unsliced second one.
    assert recorded[0].volume == {"rows": 1284}
    # The address is split for the reader without re-parsing.
    assert recorded[1].layer == "third_party"
    assert recorded[1].participant == "clearbit.com/v2/companies"


@pytest.mark.asyncio
async def test_the_readings_are_allowed_touched_never_touched_and_refused(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """R1 — declared is half of it. The difference is what a retune reads."""
    run = await _run(session, graph, user)
    allowed = [p.address for p in _CATALOGUE.participants]

    await touches.record(
        session,
        run_id=run.id,
        graph_id=graph.id,
        seq=1,
        address="graph_data/model/Routes@v4",
        direction=TouchDirection.out,
    )
    await touches.record(
        session,
        run_id=run.id,
        graph_id=graph.id,
        seq=2,
        address="third_party/api/clearbit.com/v2/companies",
        direction=TouchDirection.refused,
    )

    readings = await touches.readings(session, run_id=run.id, allowed=allowed)
    assert readings["touched"] == ["graph_data/model/Routes@v4"]
    assert readings["refused"] == ["third_party/api/clearbit.com/v2/companies"]
    # Allowed and never touched — the *narrow?* reading.
    assert "llm/anthropic-prod/claude-opus-5" in readings["never_touched"]

    counts = await touches.counts(session, run_id=run.id)
    assert counts == {"out": 1, "refused": 1}


@pytest.mark.asyncio
async def test_compare_is_the_diff_of_two_real_runs(session: AsyncSession, graph: Graph, user: User) -> None:
    """R3 · WO4 — what B touched that A did not is the deliverable."""
    run_a, run_b = await _run(session, graph, user), await _run(session, graph, user)

    for seq, address in enumerate(["graph_data/model/Routes@v4", "llm/anthropic-prod/claude-opus-5"], start=1):
        await touches.record(
            session, run_id=run_a.id, graph_id=graph.id, seq=seq, address=address, direction=TouchDirection.out
        )
    for seq, address in enumerate(["graph_data/model/Routes@v4", "llm/ollama-local/llama-3.3"], start=1):
        await touches.record(
            session, run_id=run_b.id, graph_id=graph.id, seq=seq, address=address, direction=TouchDirection.out
        )

    diff = await touches.compare(session, run_a=run_a.id, run_b=run_b.id)
    assert diff["shared"] == ["graph_data/model/Routes@v4"]
    assert diff["only_in_a"] == ["llm/anthropic-prod/claude-opus-5"]
    assert diff["only_in_b"] == ["llm/ollama-local/llama-3.3"]


@pytest.mark.asyncio
async def test_compare_says_how_two_runs_narrowed_the_same_participant(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """WO18 — *shared 1 · differed 0* is the sentence compare exists not to say."""
    run_a, run_b = await _run(session, graph, user), await _run(session, graph, user)
    address = "graph_data/model/Routes@v4"
    llm = "llm/anthropic-prod/claude-opus-5"

    await touches.record(
        session,
        run_id=run_a.id,
        graph_id=graph.id,
        seq=1,
        address=address,
        direction=TouchDirection.into,
        applied={"select": {"Route": {"time": "2026-H1"}}, "models": ["graph_data/model/Deals@1.0.1"]},
    )
    await touches.record(
        session,
        run_id=run_b.id,
        graph_id=graph.id,
        seq=1,
        address=address,
        direction=TouchDirection.into,
        applied={"properties_excluded": {"Route": ["revenue"]}, "models": ["graph_data/model/Deals@1.0.1"]},
    )
    # Both read the model the same way — shared, and nothing more to say.
    for run in (run_a, run_b):
        await touches.record(
            session, run_id=run.id, graph_id=graph.id, seq=2, address=llm, direction=TouchDirection.out
        )

    diff = await touches.compare(session, run_a=run_a.id, run_b=run_b.id)
    assert diff["shared"] == [address, llm]
    assert sorted(diff["differed"]) == [address], "a participant read identically says no more"
    entry = diff["differed"][address]
    assert entry["differs"] == ["select", "properties_excluded"]
    assert entry["a"]["select"] == {"Route": {"time": "2026-H1"}}
    assert entry["b"]["properties_excluded"] == {"Route": ["revenue"]}
    # `models` was equal on both, so it is not a difference.
    assert "models" not in entry["differs"]


@pytest.mark.asyncio
async def test_a_touch_at_a_seq_the_run_never_reached_is_absent(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    from invana.core.errors import NotFoundError

    run = await _run(session, graph, user)
    with pytest.raises(NotFoundError):
        await touches.at(session, run_id=run.id, seq=99)
