"""The lens as a row — the ladder, the permission, and the refusals that name their bound.

Real Postgres, no mocks. Each test is one claim from the design, so a failure
names the decision it broke rather than the function it called.
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.govern.addressing import Layer
from invana.apps.govern.catalogue import Catalogue, Participant
from invana.apps.govern.managers import LensManager
from invana.apps.govern.managers.lens import to_rules
from invana.apps.govern.models import LensKind
from invana.apps.govern.rules import Effective
from invana.apps.govern.schemas import LensCreate, LensUpdate, RuleIn
from invana.apps.govern.validate import validate_draft
from invana.apps.graphs.models import Graph, GraphMember
from invana.core.auth.models import User
from invana.core.errors import ConflictError, PermissionDeniedError, ValidationError

lenses = LensManager()


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


def _layered(rules: list[RuleIn]) -> Effective:
    """A layered guardrail as the world validator sees it — an agent's own is the one that remains."""
    return Effective(rules=to_rules(rules))


async def _agent_guardrail(session: AsyncSession, graph: Graph, user: User, rules: list[RuleIn]):
    return await lenses.create(
        session,
        graph_id=graph.id,
        payload=LensCreate(
            name="Analyst bounds",
            kind=LensKind.guardrail,
            scope="agent:analyst",
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


def test_a_world_cannot_widen_a_guardrail() -> None:
    """Refused at save, naming the guardrail's rule."""
    result = validate_draft(
        rules=to_rules([RuleIn(match="third_party/api/clearbit.com/**", allow=True)]),
        cast={},
        closed_layers=set(),
        guardrails=_layered([RuleIn(match="third_party/**", allow=False)]),
        catalogue=_catalogue(),
    )
    refusal = result.refusals[0]
    assert refusal.code == "widens_guardrail"
    assert refusal.recourse == "third_party/**"
    assert "Deny wins at any specificity" in refusal.message


def test_a_narrowing_world_is_fine_under_the_same_guardrail() -> None:
    """The mirror of the test above: a deny never widens, so it is always legal."""
    result = validate_draft(
        rules=to_rules([RuleIn(match="llm/ollama-local/**", allow=False)]),
        cast={},
        closed_layers=set(),
        guardrails=_layered([RuleIn(match="third_party/**", allow=False)]),
        catalogue=_catalogue(),
    )
    assert result.ok


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


def test_a_cast_the_guardrails_deny_is_refused_at_save() -> None:
    result = validate_draft(
        rules=[],
        cast={"decide": "llm/ollama-local/llama-3.3"},
        closed_layers=set(),
        guardrails=_layered([RuleIn(match="llm/ollama-local/**", allow=False)]),
        catalogue=_catalogue(),
    )
    assert result.refusals[0].code == "cast_denied"


# ── the permission ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_editing_a_guardrail_is_a_permission(session: AsyncSession, graph: Graph, user: User) -> None:
    """A member without it still reads every rule."""
    guardrail = await _agent_guardrail(session, graph, user, [RuleIn(match="third_party/**", allow=False)])

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
    """GV22 — editing a guardrail is the modeller role, which the owner implies."""
    assert member.holds("modeller") is True


# ── the delete guard ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_world_nothing_carries_deletes(session: AsyncSession, graph: Graph, user: User) -> None:
    world = await lenses.create(
        session, graph_id=graph.id, payload=LensCreate(name="Scratch"), actor_id=user.id, catalogue=_catalogue()
    )
    await lenses.delete(session, lens=world, actor_id=user.id)
    assert await lenses.list_for_graph(session, graph_id=graph.id) == []


# ── the shapes a lens may not take ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_guardrail_is_always_named_and_always_scoped(session: AsyncSession, graph: Graph, user: User) -> None:
    with pytest.raises(ValidationError, match="always named"):
        await lenses.create(
            session,
            graph_id=graph.id,
            payload=LensCreate(kind=LensKind.guardrail, scope="agent:analyst"),
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
async def test_a_graph_guardrail_is_not_a_lens(session: AsyncSession, graph: Graph, user: User) -> None:
    """A Graph's guardrail is one property rule, written under Guardrails only."""
    with pytest.raises(ValidationError, match="one property rule"):
        await lenses.create(
            session,
            graph_id=graph.id,
            payload=LensCreate(name="Bounds", kind=LensKind.guardrail, scope="graph"),
            actor_id=user.id,
            catalogue=_catalogue(),
            may_edit_guardrails=True,
        )
