"""SQLAlchemy async model for Skills (MVP § 2.4).

One ``skills`` row = one capability the Graph's agents can invoke. Hard
delete, cascade-from-Graph. Names are unique per Graph.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from invana.modeller.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class Skill(Base):
    __tablename__ = "skills"
    __table_args__ = (UniqueConstraint("graph_id", "name", name="uq_skill_graph_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("graphs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # Markdown body — the skill's "how": the operational definition the agent
    # follows.
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # Markdown — the skill's "when": signals the agent uses to decide whether
    # to apply it.
    when_to_use: Mapped[str] = mapped_column(Text, default="", nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
