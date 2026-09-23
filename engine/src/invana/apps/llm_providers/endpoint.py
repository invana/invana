"""``LLMEndpoint`` — a provider row and one of its models, resolved together.

**The unit of a call is an endpoint, not a provider**
([PM13](docs/for-developers/modules/agents/features/providers-and-models.md)).
After the split a ``llm_providers`` row cannot say *which model* and an
``llm_models`` row cannot say *on whose credential*, so nothing in the call path
holds either one alone. This is what ``llm/<provider name>/<model id>`` names —
the address, the ledger line and the argument to the client are one thing in
three notations.

It reads as the row it replaces: every attribute the call path took off an
``LLMProvider`` (``provider`` · ``model_id`` · ``base_url`` ·
``api_key_encrypted`` · ``credential_kind`` · ``guardrails``) is here, which is
why the split does not rewrite the five ``apps/llm`` callables. What it adds is
the one read they could not do before — :attr:`address`.
"""

from __future__ import annotations

from dataclasses import dataclass

from invana.apps.llm_providers.models import LLMCredentialKind, LLMModel, LLMProvider, LLMProviderKind

#: The layer segment every LLM address opens with. Kept here rather than
#: imported from Govern: an address is how the endpoint names itself, and this
#: package sits below the one that governs it.
LLM_LAYER = "llm"


@dataclass(frozen=True, slots=True)
class LLMEndpoint:
    """One configured endpoint, pinned to one of the models it offers."""

    row: LLMProvider
    model: LLMModel

    # ── what the call path reads ─────────────────────────────────────────────

    @property
    def id(self) -> str:
        """The provider row's id — what a credential is fetched by."""
        return self.row.id

    @property
    def graph_id(self) -> str:
        return self.row.graph_id

    @property
    def name(self) -> str:
        """The address's middle segment."""
        return self.row.name

    @property
    def provider(self) -> LLMProviderKind:
        """The vendor kind, which is what dispatch switches on."""
        return self.row.provider

    @property
    def model_id(self) -> str:
        """The vendor's model id — the address's last segment."""
        return self.model.model_id

    @property
    def model_row_id(self) -> str:
        """The ``llm_models`` id. What a run records, since it resolves both segments."""
        return self.model.id

    @property
    def base_url(self) -> str | None:
        return self.row.base_url

    @property
    def api_key_encrypted(self) -> bytes | None:
        return self.row.api_key_encrypted

    @property
    def credential_kind(self) -> LLMCredentialKind | None:
        return self.row.credential_kind

    @property
    def has_api_key(self) -> bool:
        return self.row.has_api_key

    @property
    def guardrails(self) -> dict:
        return self.row.guardrails or {}

    @property
    def pricing(self) -> dict:
        """The model's own rate, which is narrower than the endpoint's override."""
        return self.model.pricing or {}

    @property
    def capabilities(self) -> dict:
        return self.model.capabilities or {}

    # ── how it names itself ──────────────────────────────────────────────────

    @property
    def address(self) -> str:
        """``llm/<provider name>/<model id>`` — what a rule was written against
        and what the ledger records ([GV4](docs/for-developers/modules/govern/spec.md))."""
        return f"{LLM_LAYER}/{self.row.name}/{self.model.model_id}"

    @property
    def label(self) -> str:
        """What a failure names, in a person's words rather than an address."""
        return f"{self.row.name} · {self.model.model_id}"


def split_address(address: str) -> tuple[str, str] | None:
    """``llm/<name>/<model id>`` → its two segments, or ``None``.

    A model id may itself contain slashes (``library/qwen3:30b``), so the split
    is bounded at two and the remainder is the model — never the other way
    round, which would silently address a different provider.
    """
    parts = address.split("/", 2)
    if len(parts) != 3 or parts[0] != LLM_LAYER or not parts[1] or not parts[2]:
        return None
    return parts[1], parts[2]
