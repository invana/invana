"""Setup progress is read off the facts, not off a stored checklist.

docs/for-developers/modules/platform/features/setup.md (SU1 · SU11 · SU12) and
connect-and-model/spec.md CM8 / CM9. Real Postgres, no mocks — the whole point of
the feature is which rows exist.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph, GraphConnection
from invana.apps.llm_providers.models import LLMModel, LLMProvider, LLMProviderKind
from invana.apps.modeller.models import GraphModel, GraphVersion, NodeTypeDefinition
from invana.apps.setup.managers import SetupManager
from invana.apps.skills.models import Skill

# Imported for their side effect on Base.metadata: the conftest's `create_all`
# only builds the tables whose models have been imported by collection time.
from invana.core.auth.models import User
from invana.core.errors import ConflictError
from invana.runtime.models import TaskRun
from invana.runtime.querysets import TaskRunQuerySet

CONNECTOR = "invana.graph.connectors.neo4j.connector.Neo4jConnector"


async def _graph(session: AsyncSession, **kwargs) -> Graph:
    user = User(email="owner@example.com", username="owner", password_hash="x", first_name="Owner")
    session.add(user)
    await session.flush()
    row = Graph(slug="atlas", name="Atlas", created_by_id=user.id, setup_state={}, **kwargs)
    session.add(row)
    await session.flush()
    return row


async def _publish_model(session: AsyncSession, graph: Graph, *, origin: str = "studio") -> GraphVersion:
    model = GraphModel(graph_id=graph.id, name=f"{origin}-model", origin=origin)
    session.add(model)
    await session.flush()
    version = GraphVersion(model_id=model.id, version="1", status="active", activated_at=datetime.now(UTC))
    session.add(version)
    await session.flush()
    return version


def _setup() -> SetupManager:
    """The manager, with the reader that answers *has data landed* (§ 6.7)."""
    return SetupManager(TaskRunQuerySet())


async def _import_run(session: AsyncSession, graph: Graph, *, status: str) -> None:
    """A load is a run, and *data is in* is that run having succeeded (§ 6.7)."""
    session.add(
        TaskRun(
            graph_id=graph.id,
            ask_kind="import",
            body="Import flights",
            status=status,
            author_kind="system",
            finished_at=datetime.now(UTC) if status == "succeeded" else None,
        )
    )
    await session.flush()


@pytest.mark.asyncio
async def test_a_bare_graph_has_nothing_done(session: AsyncSession):
    graph = await _graph(session)

    state = await _setup().derive_setup_state(session, graph)

    assert [s for s, v in state.items() if v["done"]] == []
    ok, missing = await _setup().is_setup_complete(session, graph)
    assert not ok
    assert missing == ["graph_info", "model", "datasets", "providers"]


async def _offer(
    session: AsyncSession,
    graph,
    kind: LLMProviderKind,
    model_id: str,
    **ping,
) -> LLMProvider:
    """One configured endpoint offering one model — what a provider row used to be.

    There is no ``is_default``: with one model offered and no cast authored, the
    shipped cast resolves to it, which is what the gate reads
    ([PM16](docs/for-developers/modules/agents/features/providers-and-models.md)).
    """
    provider = LLMProvider(graph_id=graph.id, name=kind.value, provider=kind, guardrails={}, **ping)
    session.add(provider)
    await session.flush()
    session.add(LLMModel(provider_id=provider.id, model_id=model_id, capabilities={}, pricing={}))
    await session.flush()
    return provider


@pytest.mark.asyncio
async def test_the_facts_tick_the_steps(session: AsyncSession):
    """A connection, a published model, a succeeded run, and a pinged provider
    behind the model the cast resolves — nothing told setup about any of them."""
    graph = await _graph(session, instructions="Answer only from the graph.")
    session.add(GraphConnection(graph_id=graph.id, uri="bolt://localhost:7687", connector_class=CONNECTOR))
    session.add(Skill(graph_id=graph.id, name="reconcile"))
    await _offer(
        session,
        graph,
        LLMProviderKind.anthropic,
        "claude-opus-5",
        last_ping_at=datetime.now(UTC),
        last_ping_ok=True,
    )
    await _publish_model(session, graph)
    await _import_run(session, graph, status="succeeded")

    state = await _setup().derive_setup_state(session, graph)

    assert all(state[s]["done"] for s in state), state
    # The timeline needs a moment to draw against, taken from the row itself.
    assert state["graph_info"]["completed_at"] is not None
    assert state["datasets"]["completed_at"] is not None
    assert state["datasets"]["blocked_by"] is None
    ok, missing = await _setup().is_setup_complete(session, graph)
    assert ok
    assert missing == []


@pytest.mark.asyncio
async def test_records_already_in_the_database_count(session: AsyncSession):
    """A Graph pointed at a populated database is grounded on arrival (SU11) —
    the introspected mirror's labels are the evidence, and no import runs."""
    graph = await _graph(session)
    version = await _publish_model(session, graph, origin="introspected")
    session.add(NodeTypeDefinition(version_id=version.id, name="Company"))
    await session.flush()

    state = await _setup().derive_setup_state(session, graph)

    assert state["datasets"]["done"] is True
    # The mirror is not authorship (CM6) — it never ticks "author a model".
    assert state["model"]["done"] is False


@pytest.mark.asyncio
async def test_a_run_that_did_not_succeed_does_not_count_and_data_waits_on_a_model(session: AsyncSession):
    """Registering files is not bringing data in — and until a model is
    published the step is blocked rather than merely undone (SU12)."""
    graph = await _graph(session)
    await _import_run(session, graph, status="failed")

    state = await _setup().derive_setup_state(session, graph)

    assert state["datasets"]["done"] is False
    assert state["datasets"]["blocked_by"] == "model"


@pytest.mark.asyncio
async def test_a_provider_is_not_done_until_it_has_pinged(session: AsyncSession):
    """Saving stores it, the ping proves it (providers-and-models.md C3); a
    rejected key is broken, in the provider's own words.

    The gate reads the provider behind the model the cast resolves
    ([PM16](docs/for-developers/modules/agents/features/providers-and-models.md)) —
    with no cast authored that is the shipped cast over the one model offered,
    which is this one."""
    graph = await _graph(session)
    provider = await _offer(session, graph, LLMProviderKind.openai, "gpt-4o")

    state = await _setup().derive_setup_state(session, graph)
    assert state["providers"]["done"] is False
    assert state["providers"]["broken"] is None

    provider.last_ping_at = datetime.now(UTC)
    provider.last_ping_ok = False
    provider.last_ping_error = "Incorrect API key provided."
    await session.flush()

    state = await _setup().derive_setup_state(session, graph)
    assert state["providers"]["done"] is False
    assert state["providers"]["broken"] is None  # broken is a *done* step gone wrong


@pytest.mark.asyncio
async def test_a_gate_opens_on_its_own_steps(session: AsyncSession):
    """Authoring a model waits on the database, not on an LLM provider (SU3)."""
    graph = await _graph(session)
    session.add(GraphConnection(graph_id=graph.id, uri="bolt://localhost:7687", connector_class=CONNECTOR))
    await session.flush()

    assert await _setup().is_gate_open(session, graph, "connected") == (True, [])
    assert await _setup().is_gate_open(session, graph, "answering") == (False, ["providers"])
    assert await _setup().is_gate_open(session, graph, "grounded") == (False, ["model", "datasets"])


@pytest.mark.asyncio
async def test_a_skip_is_stored_and_reset_takes_it_back(session: AsyncSession):
    graph = await _graph(session)

    out = await _setup().update_setup_section(session, graph=graph, section="skills", action="skip", actor_id=None)
    assert out.setup_state["skills"]["skipped_at"] is not None
    assert out.setup_state["skills"]["done"] is False

    out = await _setup().update_setup_section(session, graph=graph, section="skills", action="reset", actor_id=None)
    assert out.setup_state["skills"]["skipped_at"] is None


@pytest.mark.asyncio
async def test_a_required_section_cannot_be_skipped(session: AsyncSession):
    graph = await _graph(session)

    # A manager raises core.errors; ConflictError is what server/app.py turns
    # into the 409 the API still returns.
    with pytest.raises(ConflictError):
        await _setup().update_setup_section(session, graph=graph, section="model", action="skip", actor_id=None)
