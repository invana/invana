"""SQLAlchemy async model for Instructions (MVP § 2.5).

One ``instructions`` row = one directive the Graph's agents apply. Names are
unique per Graph; ``priority`` orders the directives (higher first).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from invana.modeller.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class Instruction(Base):
    __tablename__ = "instructions"
    __table_args__ = (UniqueConstraint("graph_id", "name", name="uq_instruction_graph_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("graphs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # Higher priority = stronger weight in the agent's prompt assembly. 100 is
    # the default mid-band; explicit values let users push specific directives
    # to the top or bottom.
    priority: Mapped[int] = mapped_column(Integer, default=100, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
