"""Configuring an endpoint, and the two refusals that come with the split.

``llm_providers`` holds the credential and ``llm_models`` holds what it offers
([PM9](docs/for-developers/modules/agents/features/providers-and-models.md)), so
configuring one is two writes — and the API takes them together, because a
provider that offers nothing answers nothing.

The ``name`` **is** the address segment
([PM10](docs/for-developers/modules/agents/features/providers-and-models.md)),
which is the whole reason a collision is a refusal: two endpoints answering to
one rule is a bound that cannot say which credential it meant.
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.llm_providers.managers import LLMProviderManager
from invana.apps.llm_providers.models import LLMProviderKind
from invana.apps.llm_providers.schemas import LLMModelCreate, LLMProviderCreate, LLMProviderUpdate
from invana.core.errors import ConflictError, ValidationError

pytestmark = pytest.mark.asyncio

providers = LLMProviderManager()
_KEY = "kcTcpHnvOZ0WcmQb9SuYUwr6pEfAqfJi4o8b-h5g2vA="


def _payload(name: str, *model_ids: str) -> LLMProviderCreate:
    return LLMProviderCreate(
        name=name,
        provider=LLMProviderKind.ollama,
        base_url="http://localhost:11434",
        models=[LLMModelCreate(model_id=m) for m in model_ids],
    )


async def test_an_endpoint_is_configured_with_what_it_offers(session: AsyncSession, graph: Graph, user) -> None:
    provider = await providers.create(
        session,
        graph_id=graph.id,
        payload=_payload("workhorse", "qwen3-coder:30b", "llama3.2"),
        encryption_key=_KEY,
        actor_id=user.id,
    )

    offered = await providers.list_models(session, provider=provider)
    assert [m.model_id for m in offered] == ["qwen3-coder:30b", "llama3.2"]
    # The address is the pair, which is what a ping proves and a rule names.
    assert (await providers.first_endpoint(session, provider=provider)).address == "llm/workhorse/qwen3-coder:30b"


async def test_a_name_and_a_model_each_collide_only_once(session: AsyncSession, graph: Graph, user) -> None:
    await providers.create(
        session,
        graph_id=graph.id,
        payload=_payload("workhorse", "qwen3-coder:30b"),
        encryption_key=_KEY,
        actor_id=user.id,
    )

    with pytest.raises(ConflictError):
        await providers.create(
            session,
            graph_id=graph.id,
            payload=_payload("workhorse", "llama3.2"),
            encryption_key=_KEY,
            actor_id=user.id,
        )

    spare = await providers.create(
        session,
        graph_id=graph.id,
        payload=_payload("spare", "qwen3-coder:30b"),
        encryption_key=_KEY,
        actor_id=user.id,
    )
    # That second endpoint offers the *same* model id and is not a clash: it is
    # a second address, which is what lets two credentials reach one vendor's
    # model (GV9). Offering it twice on **one** endpoint is the clash.
    with pytest.raises(ConflictError):
        await providers.add_model(
            session,
            provider=spare,
            payload=LLMModelCreate(model_id="qwen3-coder:30b"),
            actor_id=user.id,
        )


async def test_an_endpoint_offering_nothing_cannot_be_pinged(session: AsyncSession, graph: Graph, user) -> None:
    """Nothing about the credential is in question yet — there is no call to make."""
    bare = await providers.create(
        session,
        graph_id=graph.id,
        payload=_payload("bare"),
        encryption_key=_KEY,
        actor_id=user.id,
    )
    with pytest.raises(ValidationError):
        await providers.ping(session, provider=bare, encryption_key=_KEY, actor_id=user.id)


async def test_the_name_the_backfill_wrote_can_be_saved_back(session: AsyncSession, graph: Graph, user) -> None:
    """[PM19] — migration ``53`` named every backfilled endpoint after its vendor
    kind, and ``claude_agent_sdk`` has an underscore in it.

    The address grammar accepts one, so the row is addressable and its rules
    resolve; a stricter input pattern only meant the edit form could not save
    back the name it had just displayed.
    """
    provider = await providers.create(
        session,
        graph_id=graph.id,
        payload=_payload("claude_agent_sdk", "claude-opus-5"),
        encryption_key=_KEY,
        actor_id=user.id,
    )
    await providers.update(
        session,
        provider=provider,
        payload=LLMProviderUpdate(name=provider.name, base_url="http://localhost:11435"),
        encryption_key=_KEY,
        actor_id=user.id,
    )
    assert (provider.name, provider.base_url) == ("claude_agent_sdk", "http://localhost:11435")
