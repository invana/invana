"""Spend is shown only where pricing is known (observability.md OB4 · SR40).

The two cases that matter are the two that cannot be told apart by a number:
an **unpriced** model and a **free** one. The first returns ``None`` — the Cost
tile is absent — and the second returns ``0.0``, which is a fact about a local
model rather than a missing rate.
"""

from __future__ import annotations

import pytest

from invana.apps.llm.pricing import cost_usd, rate_for
from invana.apps.llm_providers.models import LLMCredentialKind, LLMProviderKind


class _Provider:
    """The two attributes pricing reads. Not a row: no rule here touches a database."""

    def __init__(
        self,
        kind: LLMProviderKind,
        model_id: str,
        guardrails: dict | None = None,
        credential_kind: LLMCredentialKind | None = None,
    ) -> None:
        self.provider = kind
        self.model_id = model_id
        self.guardrails = guardrails
        self.credential_kind = credential_kind


def test_a_published_model_is_priced_on_its_family_prefix() -> None:
    """A dated snapshot prices as its family — no entry per release."""
    provider = _Provider(LLMProviderKind.anthropic, "claude-haiku-4-5-20251001")
    assert cost_usd(provider, 1_000_000, 0) == pytest.approx(1.0)
    assert cost_usd(provider, 0, 1_000_000) == pytest.approx(5.0)


def test_an_unknown_model_is_unpriced_rather_than_free() -> None:
    """OB4 — never estimated silently, and never `0.0`, which would read as free."""
    assert cost_usd(_Provider(LLMProviderKind.anthropic, "some-model-nobody-published"), 500, 100) is None
    assert cost_usd(_Provider(LLMProviderKind.google, "gemini-whatever"), 500, 100) is None


def test_a_local_model_is_free_and_says_so() -> None:
    assert cost_usd(_Provider(LLMProviderKind.ollama, "llama3"), 900, 300) == 0.0


def test_a_step_that_spent_no_tokens_has_no_cost() -> None:
    """A step that never called a model is not a free model call."""
    assert cost_usd(_Provider(LLMProviderKind.anthropic, "claude-sonnet-4"), None, None) is None
    assert cost_usd(None, 100, 100) is None


def test_a_providers_own_rate_wins_and_a_broken_one_is_ignored() -> None:
    exact = _Provider(
        LLMProviderKind.anthropic,
        "claude-sonnet-4",
        {"pricing": {"input_per_mtok": 1.0, "output_per_mtok": 2.0}},
    )
    assert cost_usd(exact, 1_000_000, 1_000_000) == pytest.approx(3.0)

    half_filled = _Provider(LLMProviderKind.anthropic, "claude-sonnet-4", {"pricing": {"input_per_mtok": 1.0}})
    assert rate_for(half_filled).input_per_mtok == 3.0  # falls back to the published list


def test_the_agent_sdk_prices_as_the_vendor_it_reaches_unless_it_is_a_subscription() -> None:
    """Same models, same list — but a `setup-token` call is not metered per token."""
    with_key = _Provider(LLMProviderKind.claude_agent_sdk, "claude-sonnet-4-5")
    assert cost_usd(with_key, 1_000_000, 0) == pytest.approx(3.0)

    on_a_plan = _Provider(
        LLMProviderKind.claude_agent_sdk,
        "claude-sonnet-4-5",
        credential_kind=LLMCredentialKind.oauth_token,
    )
    assert cost_usd(on_a_plan, 1_000_000, 0) is None
