"""What this Graph's MCP server serves.

docs/for-developers/modules/platform/features/this-graphs-mcp-server.md.

Tables
------
- ``mcp_served`` — one switch per agent or function a builder turned on or off.

A candidate with no row is not served: everything starts off, and a row is
written the first time someone flips its switch.
"""

from __future__ import annotations

import enum
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from invana.core.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


class ServedKind(enum.StrEnum):
    agent = "agent"
    function = "function"


class McpServed(Base):
    """Whether one agent or function is served by its Graph's MCP server."""

    __tablename__ = "mcp_served"

    graph_id: Mapped[str] = mapped_column(String(36), ForeignKey("graphs.id", ondelete="CASCADE"), primary_key=True)
    kind: Mapped[str] = mapped_column(String(16), primary_key=True)
    #: The agent's id, or the function's dotted key.
    ref: Mapped[str] = mapped_column(String(64), primary_key=True)
    served: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    changed_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
