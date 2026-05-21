"""SQLAlchemy async model for LLM providers (MVP § 2.6).

One ``llm_providers`` row = one configured LLM endpoint scoped to a Graph
(``Anthropic | OpenAI | Google | Azure | Ollama | local``). Hard delete,
cascade-from-Graph (matches RFC-012 cascade matrix). At most one row per
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
)
from sqlalchemy.orm import Mapped, mapped_column

from invana.modeller.models import Base


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


_llm_provider_kind_enum = Enum(
    LLMProviderKind,
    name="llm_provider_kind",
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
    # Used by azure (endpoint URL) and ollama (e.g. http://localhost:11434).
    base_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    # Token budgets, allowed model families, etc. (free-form).
    guardrails: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # Only one row per graph may have is_default=true (enforced by a partial
    # unique index in the Alembic migration).
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
