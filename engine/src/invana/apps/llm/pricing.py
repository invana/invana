"""What a model call cost, in dollars
(docs/for-developers/modules/operate/features/see-what-ran.md SR40 ·
docs/for-developers/modules/operate/features/observability.md OB4).

Tokens are a fact the provider returns. Money is tokens x a **rate**, and a rate
is a fact about a vendor's model rather than state a Graph owns — so it is not a
table, it is a list that ships with the distribution and is corrected by a
release.

**Unknown is not zero.** A model with no rate here and no override on its
provider returns ``None``, the column stays ``NULL`` and the Cost tile is absent
rather than reading ``$0.00`` (OB4). Estimating silently is the one thing this
must not do.

Three sources, narrowest first:

| Source | For |
|---|---|
| ``llm_models.pricing`` | this model's own rate, which is where a rate belongs now the model is a row |
| ``provider.guardrails["pricing"]`` | an exact contract rate for the whole endpoint |
| the list below | the vendors' published list rates, matched on a model-id prefix |

A rate is priced against an **endpoint**
([PM13](docs/for-developers/modules/agents/features/providers-and-models.md)),
not a provider: until the split the row that carried the rate was the row that
carried the key, and those are two different facts.

A local provider (``ollama`` · ``local``) is **priced at zero**, which is a fact
and not a guess: the call spends no API dollars. What it spends is a machine,
and that is not a number this column claims to carry.
"""

from __future__ import annotations

from dataclasses import dataclass

from invana.apps.llm_providers.endpoint import LLMEndpoint
from invana.apps.llm_providers.models import LLMCredentialKind, LLMProviderKind


@dataclass(frozen=True, slots=True)
class Rate:
    """Dollars per **million** tokens — the unit every vendor publishes in."""

    input_per_mtok: float
    output_per_mtok: float

    def usd(self, tokens_in: int, tokens_out: int) -> float:
        return (tokens_in * self.input_per_mtok + tokens_out * self.output_per_mtok) / 1_000_000


#: Published list rates, matched on the **longest** model-id prefix that fits, so
#: a dated id (``claude-haiku-4-5-20251001``) prices as its family without an
#: entry per snapshot. A model absent from here is unknown, not free.
_RATES: dict[LLMProviderKind, dict[str, Rate]] = {
    LLMProviderKind.anthropic: {
        "claude-opus-4": Rate(15.0, 75.0),
        "claude-sonnet-4": Rate(3.0, 15.0),
        "claude-haiku-4": Rate(1.0, 5.0),
        "claude-3-5-haiku": Rate(0.80, 4.0),
        "claude-3-5-sonnet": Rate(3.0, 15.0),
        "claude-3-opus": Rate(15.0, 75.0),
        "claude-3-haiku": Rate(0.25, 1.25),
    },
    LLMProviderKind.openai: {
        "gpt-4o-mini": Rate(0.15, 0.60),
        "gpt-4o": Rate(2.50, 10.0),
        "gpt-4-turbo": Rate(10.0, 30.0),
    },
}

#: Kinds whose calls spend no API dollars. Zero is the honest number here — the
#: call is free, not unpriced.
_FREE_KINDS = frozenset({LLMProviderKind.ollama, LLMProviderKind.local})

#: The Claude Agent SDK reaches the **same vendor and the same models** as an
#: API key does, so it reads the same list — but only when it *is* an API key.
_PRICED_AS = {LLMProviderKind.claude_agent_sdk: LLMProviderKind.anthropic}


def rate_for(provider: LLMEndpoint) -> Rate | None:
    """This endpoint's rate, or ``None`` when nobody has published one."""
    override = _override(provider)
    if override is not None:
        return override
    if provider.provider in _FREE_KINDS:
        return Rate(0.0, 0.0)
    if _on_a_subscription(provider):
        # A `claude setup-token` call is covered by a subscription: it is not
        # metered per token, and it is not free either. Neither number is true,
        # so there is none — which is what `None` says (OB4).
        return None
    published = _RATES.get(_PRICED_AS.get(provider.provider, provider.provider)) or {}
    model_id = (provider.model_id or "").lower()
    matches = [prefix for prefix in published if model_id.startswith(prefix)]
    if not matches:
        return None
    return published[max(matches, key=len)]


def cost_usd(provider: LLMEndpoint | None, tokens_in: int | None, tokens_out: int | None) -> float | None:
    """What a call on ``provider`` cost, or ``None`` when the rate is unknown.

    A step that spent no tokens has no cost to record — ``None`` rather than
    ``0.0``, so a step that never called a model is not drawn as a free one.
    """
    if provider is None or not (tokens_in or tokens_out):
        return None
    rate = rate_for(provider)
    if rate is None:
        return None
    # Six places: a haiku call on a few hundred tokens is fractions of a cent,
    # and rounding it to the nearest cent would record every cheap step as free.
    return round(rate.usd(tokens_in or 0, tokens_out or 0), 6)


def _on_a_subscription(provider: LLMEndpoint) -> bool:
    """A Claude Agent SDK endpoint holding an OAuth token rather than an API key.

    ``NULL`` on a legacy row means api-key semantics, exactly as the column
    documents — so only an explicit ``oauth_token`` is a subscription.
    """
    return (
        provider.provider is LLMProviderKind.claude_agent_sdk
        and provider.credential_kind is LLMCredentialKind.oauth_token
    )


def _override(provider: LLMEndpoint) -> Rate | None:
    """The model's own rate, then the endpoint's — narrowest first.

    Read defensively: both are free-form columns a person edits, and a
    half-filled override is *no override* rather than a crash or a half-priced
    run. A blank model rate falls through to the endpoint's rather than
    overriding it with nothing.
    """
    for pricing in (provider.pricing, (provider.guardrails or {}).get("pricing")):
        if not isinstance(pricing, dict):
            continue
        try:
            return Rate(float(pricing["input_per_mtok"]), float(pricing["output_per_mtok"]))
        except (KeyError, TypeError, ValueError):
            continue
    return None
