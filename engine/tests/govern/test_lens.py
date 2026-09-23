"""The lens as a row — the ladder, the permission, and the refusals that name their bound.

Real Postgres, no mocks. Each test is one claim from the design, so a failure
names the decision it broke rather than the function it called.
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent
from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.govern.addressing import Layer
from invana.apps.govern.catalogue import Catalogue, Participant
from invana.apps.govern.managers import LensManager
from invana.apps.govern.models import LensKind
from invana.apps.govern.schemas import LensCreate, LensUpdate, RuleIn
from invana.apps.graphs.models import Graph, GraphMember
from invana.core.auth.models import User
from invana.core.errors import ConflictError, PermissionDeniedError, ValidationError

lenses = LensManager()
agents_q = AgentQuerySet()


def _catalogue() -> Catalogue:
    """A small Graph: two models, one of which declares no axes, and two models on one provider."""
    return Catalogue(
        participants=(
            Participant(
                address="graph_data/model/Routes@v4",
                layer=Layer.graph_data,
                sublayer="model",
                name="Routes@v4",
                label="Routes@v4",
                axes={"time": {"property": "observed_at"}, "geo": {"property": "country_iso"}},
                properties=("pax", "revenue", "observed_at"),
            ),
            Participant(
                address="graph_data/model/Airports@v1",
                layer=Layer.graph_data,
                sublayer="model",
                name="Airports@v1",
                label="Airports@v1",
                axes={},
            ),
            Participant(
                address="llm/anthropic-prod/claude-opus-5",
                layer=Layer.llm,
                sublayer="anthropic-prod",
                name="claude-opus-5",
                label="claude-opus-5",
            ),
            Participant(
                address="llm/ollama-local/llama-3.3",
                layer=Layer.llm,
                sublayer="ollama-local",
                name="llama-3.3",
                label="llama-3.3",
            ),
        )
    )


async def _guardrail(session: AsyncSession, graph: Graph, user: User, rules: list[RuleIn]):
    return await lenses.create(
        session,
        graph_id=graph.id,
        payload=LensCreate(
            name="Graph guardrails",
            kind=LensKind.guardrail,
            scope="graph",
            rules=rules,
        ),
        actor_id=user.id,
        catalogue=_catalogue(),
        may_edit_guardrails=True,
    )


# ── the ladder ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_lens_starts_unnamed_and_naming_is_what_publishes(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """WO1 · GV2 — an unnamed lens is private to its run, and there is no share action."""
    lens = await lenses.create(
        session,
        graph_id=graph.id,
        payload=LensCreate(rules=[RuleIn(match="graph_data/model/Routes@v4", allow=True)]),
        actor_id=user.id,
        catalogue=_catalogue(),
    )
    assert lens.key is None and not lens.is_named
    assert lens.display_name == "this run only"
    # It is in nobody's list until it is named.
    assert await lenses.list_for_graph(session, graph_id=graph.id) == []

    named = await lenses.update(
        session,
        lens=lens,
        payload=LensUpdate(name="EU · H1 2026"),
        actor_id=user.id,
        catalogue=_catalogue(),
    )
    assert named.key == "eu-h1-2026"
    assert named.name == "EU · H1 2026"
    assert [item.id for item in await lenses.list_for_graph(session, graph_id=graph.id)] == [lens.id]


@pytest.mark.asyncio
async def test_a_rename_is_just_a_rename(session: AsyncSession, graph: Graph, user: User) -> None:
    """WO1 — only the *first* naming publishes, so the slug is frozen (GV19)."""
    lens = await lenses.create(
        session,
        graph_id=graph.id,
        payload=LensCreate(name="EU · H1 2026"),
        actor_id=user.id,
        catalogue=_catalogue(),
    )
    renamed = await lenses.update(
        session,
        lens=lens,
        payload=LensUpdate(name="Europe, first half"),
        actor_id=user.id,
        catalogue=_catalogue(),
    )
    assert renamed.name == "Europe, first half"
    # The schedules that pinned `eu-h1-2026` still resolve.
    assert renamed.key == "eu-h1-2026"


@pytest.mark.asyncio
async def test_two_worlds_cannot_share_a_name(session: AsyncSession, graph: Graph, user: User) -> None:
    await lenses.create(
        session, graph_id=graph.id, payload=LensCreate(name="EU · H1 2026"), actor_id=user.id, catalogue=_catalogue()
    )
    with pytest.raises(ConflictError, match="already exists"):
        await lenses.create(
            session,
            graph_id=graph.id,
            payload=LensCreate(name="EU · H1 2026"),
            actor_id=user.id,
            catalogue=_catalogue(),
        )


@pytest.mark.asyncio
async def test_promoting_is_one_field_and_no_re_authoring(session: AsyncSession, graph: Graph, user: User) -> None:
    """GV1 · GV3 — a guardrail and a world are one row separated by `kind`."""
    world = await lenses.create(
        session,
        graph_id=graph.id,
        payload=LensCreate(name="Nothing leaves", rules=[RuleIn(match="third_party/**", allow=False)]),
        actor_id=user.id,
        catalogue=_catalogue(),
    )
    rules_before = list(world.rules)

    promoted = await lenses.promote(session, lens=world, scope="graph", actor_id=user.id, may_edit_guardrails=True)
    assert promoted.id == world.id
    assert promoted.kind == LensKind.guardrail.value
    assert promoted.rules == rules_before

    # It leaves the Worlds list and appears under Guardrails (GR1).
    worlds = await lenses.list_for_graph(session, graph_id=graph.id, kind=LensKind.world.value)
    assert promoted.id not in [w.id for w in worlds]
    guardrails = await lenses.list_for_graph(session, graph_id=graph.id, kind=LensKind.guardrail.value)
    assert promoted.id in [g.id for g in guardrails]


@pytest.mark.asyncio
async def test_a_duplicate_starts_private(session: AsyncSession, graph: Graph, user: User) -> None:
    world = await lenses.create(
        session,
        graph_id=graph.id,
        payload=LensCreate(name="EU · H1 2026", rules=[RuleIn(match="third_party/**", allow=False)]),
        actor_id=user.id,
        catalogue=_catalogue(),
    )
    copy = await lenses.duplicate(session, lens=world, actor_id=user.id)
    assert copy.rules == world.rules
    assert copy.key is None, "a copy is unnamed, so naming it stays a decision"


# ── the refusals ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_world_cannot_widen_a_guardrail(session: AsyncSession, graph: Graph, user: User) -> None:
    """W3 · GV5 — refused at save, naming the guardrail's rule."""
    await _guardrail(session, graph, user, [RuleIn(match="third_party/**", allow=False)])

    with pytest.raises(ValidationError) as exc:
        await lenses.create(
            session,
            graph_id=graph.id,
            payload=LensCreate(
                name="Enriched",
                rules=[RuleIn(match="third_party/api/clearbit.com/**", allow=True)],
            ),
            actor_id=user.id,
            catalogue=_catalogue(),
        )
    refusals = exc.value.detail["refusals"]
    assert refusals[0]["code"] == "widens_guardrail"
    assert refusals[0]["recourse"] == "third_party/**"
    assert "Deny wins at any specificity" in refusals[0]["message"]


@pytest.mark.asyncio
async def test_a_narrowing_world_is_fine_under_the_same_guardrail(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """The mirror of the test above: a deny never widens, so it is always legal."""
    await _guardrail(session, graph, user, [RuleIn(match="third_party/**", allow=False)])
    world = await lenses.create(
        session,
        graph_id=graph.id,
        payload=LensCreate(
            name="Tighter still",
            rules=[RuleIn(match="llm/ollama-local/**", allow=False)],
        ),
        actor_id=user.id,
        catalogue=_catalogue(),
    )
    assert world.is_named


@pytest.mark.asyncio
async def test_only_declared_axes_are_selectable(session: AsyncSession, graph: Graph, user: User) -> None:
    """W3 · GV14 — refused naming the model *and* the axis."""
    with pytest.raises(ValidationError) as exc:
        await lenses.create(
            session,
            graph_id=graph.id,
            payload=LensCreate(
                name="Airports by country",
                rules=[
                    RuleIn(
                        match="graph_data/model/Airports@v1",
                        allow=True,
                        select={"geo": {"in": ["IE"]}},
                    )
                ],
            ),
            actor_id=user.id,
            catalogue=_catalogue(),
        )
    refusal = exc.value.detail["refusals"][0]
    assert refusal["code"] == "undeclared_axis"
    assert "Airports@v1" in refusal["message"] and "geo" in refusal["message"]
    assert refusal["recourse"] == "graph_data/model/Airports@v1"


@pytest.mark.asyncio
async def test_slicing_a_model_that_declared_the_axis_is_allowed(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    world = await lenses.create(
        session,
        graph_id=graph.id,
        payload=LensCreate(
            name="EU · H1 2026",
            rules=[
                RuleIn(
                    match="graph_data/model/Routes@v4",
                    allow=True,
                    select={"geo": {"axis": "country_iso", "in": ["IE", "DE", "FR"]}},
                )
            ],
        ),
        actor_id=user.id,
        catalogue=_catalogue(),
    )
    assert world.rules[0]["select"]["geo"]["in"] == ["IE", "DE", "FR"]


@pytest.mark.asyncio
async def test_a_cast_the_guardrails_deny_is_refused_at_save(session: AsyncSession, graph: Graph, user: User) -> None:
    await _guardrail(session, graph, user, [RuleIn(match="llm/ollama-local/**", allow=False)])
    with pytest.raises(ValidationError) as exc:
        await lenses.create(
            session,
            graph_id=graph.id,
            payload=LensCreate(name="Local decide", cast={"decide": "llm/ollama-local/llama-3.3"}),
            actor_id=user.id,
            catalogue=_catalogue(),
        )
    assert exc.value.detail["refusals"][0]["code"] == "cast_denied"


# ── the permission ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_editing_a_guardrail_is_a_permission(session: AsyncSession, graph: Graph, user: User) -> None:
    """GR5 — a member without it still reads every rule."""
    guardrail = await _guardrail(session, graph, user, [RuleIn(match="third_party/**", allow=False)])

    with pytest.raises(PermissionDeniedError, match="You can read every rule in force"):
        await lenses.update(
            session,
            lens=guardrail,
            payload=LensUpdate(rules=[]),
            actor_id=user.id,
            catalogue=_catalogue(),
            may_edit_guardrails=False,
        )

    # Reading is not gated.
    listed = await lenses.list_for_graph(session, graph_id=graph.id, kind=LensKind.guardrail.value)
    assert [item.id for item in listed] == [guardrail.id]


@pytest.mark.asyncio
async def test_the_owner_holds_the_permission(session: AsyncSession, member: GraphMember) -> None:
    """GV22 — a Graph always has at least one holder."""
    assert member.can_edit_guardrails is True


# ── the delete guard ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_deleting_a_world_an_agent_carries_is_refused_naming_it(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """WO6 — widening an agent by deleting its world is the opposite of a bound."""
    world = await lenses.create(
        session, graph_id=graph.id, payload=LensCreate(name="EU · H1 2026"), actor_id=user.id, catalogue=_catalogue()
    )
    session.add(Agent(graph_id=graph.id, name="Analyst", lens_id=world.id))
    await session.flush()

    held_by = await agents_q.names_using_lens(session, world.id)
    assert held_by == ["Analyst"]

    with pytest.raises(ConflictError, match="Analyst"):
        await lenses.delete(session, lens=world, actor_id=user.id, held_by=held_by)


@pytest.mark.asyncio
async def test_a_world_nothing_carries_deletes(session: AsyncSession, graph: Graph, user: User) -> None:
    world = await lenses.create(
        session, graph_id=graph.id, payload=LensCreate(name="Scratch"), actor_id=user.id, catalogue=_catalogue()
    )
    await lenses.delete(session, lens=world, actor_id=user.id, held_by=[])
    assert await lenses.list_for_graph(session, graph_id=graph.id) == []


# ── the shapes a lens may not take ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_guardrail_is_always_named_and_always_scoped(session: AsyncSession, graph: Graph, user: User) -> None:
    with pytest.raises(ValidationError, match="always named"):
        await lenses.create(
            session,
            graph_id=graph.id,
            payload=LensCreate(kind=LensKind.guardrail, scope="graph"),
            actor_id=user.id,
            catalogue=_catalogue(),
            may_edit_guardrails=True,
        )
    with pytest.raises(ValidationError, match="pinned on the Graph or on an agent"):
        await lenses.create(
            session,
            graph_id=graph.id,
            payload=LensCreate(name="Bounds", kind=LensKind.guardrail),
            actor_id=user.id,
            catalogue=_catalogue(),
            may_edit_guardrails=True,
        )


@pytest.mark.asyncio
async def test_an_unnamed_guardrail_cannot_be_promoted_into_existence(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    lens = await lenses.create(
        session, graph_id=graph.id, payload=LensCreate(), actor_id=user.id, catalogue=_catalogue()
    )
    with pytest.raises(ValidationError, match="Name it first"):
        await lenses.promote(session, lens=lens, scope="graph", actor_id=user.id, may_edit_guardrails=True)
