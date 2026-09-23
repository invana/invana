"""SQLAlchemy async models for LLM providers and the models they offer.

One ``llm_providers`` row = one **configured endpoint** scoped to a Graph: a
name somebody chose, a vendor kind, a base URL and exactly one credential. One
``llm_models`` row = one model that endpoint offers. Two tables and not one,
because ``llm/anthropic-prod/claude-opus-5`` has a provider segment and a model
segment and they are not the same thing
([PM9](docs/for-developers/modules/agents/features/providers-and-models.md) ·
[GV9](docs/for-developers/modules/govern/spec.md)).

There is **no default provider** — the lens ``cast`` answers *which model when
nobody said*, and a second mechanism would disagree with it
([PM4](docs/for-developers/modules/agents/features/providers-and-models.md)).

Hard delete, cascade-from-Graph (matches the redesign's initial schema cascade
matrix); a provider's models cascade with it.
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from invana.core.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class LLMProviderKind(enum.StrEnum):
    anthropic = "anthropic"
    openai = "openai"
    google = "google"
    azure = "azure"
    ollama = "ollama"
    local = "local"
    # Claude via the Claude Agent SDK / Claude Code CLI
    # (docs/for-developers/modules/agents/features/providers-and-models.md). API key optional.
    claude_agent_sdk = "claude_agent_sdk"


_llm_provider_kind_enum = Enum(
    LLMProviderKind,
    name="llm_provider_kind",
    values_callable=lambda x: [m.value for m in x],
    create_type=False,
)


class LLMCredentialKind(enum.StrEnum):
    """Disambiguates what ``api_key_encrypted`` holds for ``claude_agent_sdk`` rows
    (docs/for-developers/modules/agents/features/providers-and-models.md).

    Meaningless for every other provider kind, where the column is always an API key.
    """

    api_key = "api_key"
    oauth_token = "oauth_token"


_llm_credential_kind_enum = Enum(
    LLMCredentialKind,
    name="llm_credential_kind",
    values_callable=lambda x: [m.value for m in x],
    create_type=False,
)


class LLMModelStatus(enum.StrEnum):
    """Whether this model is still offered. Removing one a cast names is refused,
    naming the worlds ([PM11](docs/for-developers/modules/agents/features/providers-and-models.md))."""

    active = "active"
    removed = "removed"


class LLMProvider(Base):
    __tablename__ = "llm_providers"
    __table_args__ = (
        # The address segment, so it collides per Graph and nowhere wider:
        # two Graphs may each have an `anthropic-prod`.
        UniqueConstraint("graph_id", "name", name="uq_llm_provider_graph_name"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("graphs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    #: The address segment — ``llm/<name>/<model id>``. A word somebody picked
    #: and can read back in a refusal, never the vendor and never a uuid
    #: ([PM10](docs/for-developers/modules/agents/features/providers-and-models.md)).
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    provider: Mapped[LLMProviderKind] = mapped_column(_llm_provider_kind_enum, nullable=False)
    # Nullable: ollama / local providers don't need a key.
    api_key_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    # Disambiguates api_key_encrypted for claude_agent_sdk rows
    # (docs/for-developers/modules/agents/features/providers-and-models.md): a
    # Claude API key vs. a `claude setup-token` subscription token. NULL for
    # every other provider kind, and for legacy claude_agent_sdk rows — where
    # it means "api_key" semantics (docs/for-developers/modules/agents/features/providers-and-models.md's original, only
    # shape).
    credential_kind: Mapped[LLMCredentialKind | None] = mapped_column(_llm_credential_kind_enum, nullable=True)
    # Used by azure (endpoint URL) and ollama (e.g. http://localhost:11434).
    base_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    # Token budgets, allowed model families, etc. (free-form).
    guardrails: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # What the last ping came back with. Saving stores a provider; the ping proves
    # it (providers-and-models.md C3), and setup's Answering gate waits on the
    # proof rather than on the row
    # (docs/for-developers/modules/platform/features/setup.md).
    # NULL = never pinged, which is neither passing nor broken.
    last_ping_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_ping_ok: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    # The provider's own message, verbatim (C3). Cleared on a passing ping.
    last_ping_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    @property
    def has_api_key(self) -> bool:
        """Whether a credential is stored. The ciphertext never leaves the engine, so the
        API and the audit trail carry this instead."""
        return self.api_key_encrypted is not None


class LLMModel(Base):
    """One model a configured endpoint offers — the address's last segment.

    ``capabilities`` carries what the **shipped cast** reads and nothing it does
    not ([PM12](docs/for-developers/modules/agents/features/providers-and-models.md)):
    ``context_window`` · ``supports_tools`` · ``embedding`` state what the vendor
    offers, and ``cost_rank`` · ``power_rank`` · ``local`` are the ordering
    ``shipped_cast`` resolves *cheapest that can read* and *most capable*
    against. Ranks are seeded at the backfill and editable per row, because a
    Graph on a negotiated rate knows its own order.
    """

    __tablename__ = "llm_models"
    __table_args__ = (UniqueConstraint("provider_id", "model_id", name="uq_llm_model_provider_model"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    provider_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("llm_providers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    #: The vendor's own id — ``claude-opus-5``. The address's last segment.
    model_id: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    capabilities: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    #: ``{input_per_mtok, output_per_mtok}``; falls back to ``apps/llm/pricing.py``
    #: when empty, and an empty override is *no override* rather than free.
    pricing: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default=LLMModelStatus.active.value, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    @property
    def is_active(self) -> bool:
        return self.status == LLMModelStatus.active.value
