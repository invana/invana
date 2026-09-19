"""SQLAlchemy async model for LLM providers (MVP § 2.6).

One ``llm_providers`` row = one configured LLM endpoint scoped to a Graph
(``Anthropic | OpenAI | Google | Azure | Ollama | local | Claude Agent SDK``). Hard delete,
cascade-from-Graph (matches the redesign's initial schema cascade matrix). At most one row per
Graph can be ``is_default = true`` (partial unique index in the migration).
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


class LLMProvider(Base):
    __tablename__ = "llm_providers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("graphs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    provider: Mapped[LLMProviderKind] = mapped_column(_llm_provider_kind_enum, nullable=False)
    model_id: Mapped[str] = mapped_column(String(255), nullable=False)
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
    # Only one row per graph may have is_default=true (enforced by a partial
    # unique index in the Alembic migration).
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

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
