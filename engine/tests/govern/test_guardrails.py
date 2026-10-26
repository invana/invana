"""A Graph's guardrail as one property rule, and the requests its refusals file.

Real Postgres, no mocks. The target is checked against a published model, so
every test here starts from one.
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.govern.catalogue import Catalogue
from invana.apps.govern.managers import GuardrailManager, LensManager, RequestManager
from invana.apps.govern.models import GuardrailAccess, Lens, RequestKind, RequestSource
from invana.apps.govern.schemas import GuardrailIn, LensCreate, RequestResolve
from invana.apps.graphs.models import Graph
from invana.apps.modeller.models import (
    GraphModel,
    GraphVersion,
    NodeTypeDefinition,
    PropertyKeyDefinition,
    TypePropertyMapping,
)
from invana.apps.standards.models import StandardVersion  # noqa: F401
from invana.core.auth.models import User
from invana.core.errors import ConflictError, ValidationError

guardrails = GuardrailManager()
lenses = LensManager()
requests = RequestManager()


@pytest.fixture
async def published(session: AsyncSession, graph: Graph) -> None:
    """One active version: ``Deal`` carries ``contract_value`` and ``stage``."""
    model = GraphModel(graph_id=graph.id, name="Sales", description="", package_id="sales")
    session.add(model)
    await session.flush()
    version = GraphVersion(model_id=model.id, version="1.0.0", status="active", axes={})
    session.add(version)
    await session.flush()
    deal = NodeTypeDefinition(version_id=version.id, name="Deal", description="")
    session.add(deal)
    await session.flush()
    for name in ("contract_value", "stage"):
        key = PropertyKeyDefinition(version_id=version.id, name=name, type="string")
        session.add(key)
        await session.flush()
        session.add(TypePropertyMapping(node_type_id=deal.id, property_key_id=key.id))
    await session.flush()


async def _rule(session: AsyncSession, graph: Graph, user: User, target: str, access: str, leaves: bool) -> Lens:
    return await guardrails.create(
        session,
        graph_id=graph.id,
        payload=GuardrailIn(target=target, access=GuardrailAccess(access), leaves=leaves),
        actor_id=user.id,
        may_edit=True,
    )


# ── the rule ─────────────────────────────────────────────────────────────────


async def test_a_saved_rule_is_named_and_compiled(session: AsyncSession, graph: Graph, user: User, published) -> None:
    lens = await _rule(session, graph, user, "Deal.contract_value", "counts", False)

    assert lens.name == "Deal.contract_value in counts only · stays in the Graph"
    assert lens.rules[0]["properties"] == {"counts_only": ["Deal.contract_value"]}
    assert sorted(r["match"] for r in lens.rules[1:]) == ["llm/**", "third_party/**"]


async def test_read_and_may_leave_narrows_nothing(session: AsyncSession, graph: Graph, user: User, published) -> None:
    with pytest.raises(ValidationError, match="narrows nothing"):
        await _rule(session, graph, user, "Deal.contract_value", "read", True)


async def test_one_rule_per_target(session: AsyncSession, graph: Graph, user: User, published) -> None:
    held = await _rule(session, graph, user, "Deal.contract_value", "never", True)

    with pytest.raises(ConflictError, match=held.name):
        await _rule(session, graph, user, "Deal.contract_value", "counts", False)


async def test_a_target_no_published_model_declares_is_refused(
    session: AsyncSession, graph: Graph, user: User, published
) -> None:
    with pytest.raises(ValidationError, match="price"):
        await _rule(session, graph, user, "Deal.price", "never", True)


async def test_a_world_it_is_allowed_in_runs_without_it(
    session: AsyncSession, graph: Graph, user: User, published
) -> None:
    rule = await _rule(session, graph, user, "Deal.contract_value", "never", True)
    world = await lenses.create(
        session, graph_id=graph.id, payload=LensCreate(name="Finance"), actor_id=user.id, catalogue=Catalogue(())
    )
    rule.allowed_in = [world.id]
    await session.flush()

    elsewhere = await lenses.effective_guardrails(session, graph_id=graph.id)
    inside = await lenses.effective_guardrails(session, graph_id=graph.id, world_id=world.id)

    assert elsewhere.rules and not inside.rules


# ── the request it files ─────────────────────────────────────────────────────


async def _refusal(session: AsyncSession, graph: Graph, user: User, guardrail: Lens):
    return await requests.file(
        session,
        graph_id=graph.id,
        kind=RequestKind.guardrail,
        title="What is the contract value of the Acme deal?",
        source=RequestSource.explorer,
        asked_by_id=user.id,
        guardrail=guardrail,
    )


async def test_the_same_ask_again_is_one_request(session: AsyncSession, graph: Graph, user: User, published) -> None:
    rule = await _rule(session, graph, user, "Deal.contract_value", "never", True)

    first = await _refusal(session, graph, user, rule)
    again = await _refusal(session, graph, user, rule)

    assert again.id == first.id
    assert again.asks == 2
    assert again.blocked_by == rule.name
    assert await requests.open_count(session, graph_id=graph.id) == 1


async def test_allow_in_a_world_edits_the_guardrail_once(
    session: AsyncSession, graph: Graph, user: User, published
) -> None:
    rule = await _rule(session, graph, user, "Deal.contract_value", "never", True)
    world = await lenses.create(
        session, graph_id=graph.id, payload=LensCreate(name="Finance"), actor_id=user.id, catalogue=Catalogue(())
    )
    request = await _refusal(session, graph, user, rule)

    done = await requests.resolve(
        session,
        request=request,
        payload=RequestResolve(action="allow", world_id=world.id),
        actor_id=user.id,
        may_resolve=True,
    )

    assert done.status == "done" and done.resolution == "allowed"
    assert done.resolution_note == "allowed in Finance"
    assert rule.allowed_in == [world.id]
    with pytest.raises(ConflictError, match="already resolved"):
        await requests.resolve(
            session, request=done, payload=RequestResolve(action="decline"), actor_id=user.id, may_resolve=True
        )
