"""An unsaved :class:`LLMEndpoint`, for the callables that take one.

A call takes a provider **and** a model
([PM13](docs/for-developers/modules/agents/features/providers-and-models.md)),
and these tests reach a live Ollama rather than a database — so the pair is
built in memory, exactly as the split leaves it.
"""

from __future__ import annotations

from invana.apps.llm_providers.endpoint import LLMEndpoint
from invana.apps.llm_providers.models import LLMModel, LLMProvider, LLMProviderKind


def endpoint(
    kind: LLMProviderKind,
    model_id: str,
    *,
    name: str | None = None,
    base_url: str | None = None,
) -> LLMEndpoint:
    return LLMEndpoint(
        row=LLMProvider(name=name or kind.value, provider=kind, base_url=base_url, guardrails={}),
        model=LLMModel(model_id=model_id, capabilities={}, pricing={}),
    )
