"""SQLAlchemy models for annotations (docs/for-developers/modules/explore/features/annotations.md).

An **annotation** is what a person or the assistant says about the graph's
records — a node, a relationship, one of its values, a set or a group of them.
It belongs to the Graph, not to a board: any board that loads a record shows the
annotations on it. It lives here, in the app database, and is never written to
the customer's graph database.

===================  ==========================================================
``Annotation``       what it says, its kind, where it was written, its reach
``AnnotationAnchor`` one row per record it is on — so *what is on these records*
                     is one indexed lookup rather than a scan of JSON
===================  ==========================================================

Records are addressed by the graph database's element id. A record deleted or
re-created under a new id leaves its annotation in place, listed by the host as
*its record was deleted*.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from invana.core.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


#: The anchor's shape. ``note`` and ``value`` are on one record; ``highlight``
#: on one or more nodes; ``group`` on two or more.
ANNOTATION_KINDS = ("note", "value", "highlight", "group")
#: Colour names, each a theme token in the host — never a hex.
ANNOTATION_COLORS = ("amber", "blue", "green", "red", "grey")
#: ``session``: seen only in the session it was written in. ``graph``: by every
#: board and session that loads its records.
ANNOTATION_REACH = ("session", "graph")
ANNOTATION_AUTHORS = ("user", "assistant")


class Annotation(Base):
    __tablename__ = "annotations"
    __table_args__ = (Index("ix_annotations_graph_created", "graph_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False)
    #: One of ``ANNOTATION_KINDS``.
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    #: ``[{id, kind: node|edge, label}]`` in the order written.
    records: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    #: The property a ``value`` annotation is on.
    prop: Mapped[str | None] = mapped_column(String(255), nullable=True)
    #: The value when written; the host compares it with the record's now.
    value_then: Mapped[object | None] = mapped_column(JSON, nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    #: A group's name.
    label: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    color: Mapped[str] = mapped_column(String(16), nullable=False, default="amber")
    author_kind: Mapped[str] = mapped_column(String(16), nullable=False, default="user")
    #: The person, or the session's owner when the assistant wrote it.
    created_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    #: Where it was written. Provenance; reach decides who sees it.
    session_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    #: The reply that wrote it, when the assistant did.
    message_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("session_messages.id", ondelete="SET NULL"), nullable=True
    )
    reach: Mapped[str] = mapped_column(String(16), nullable=False, default="graph")
    #: Who added an assistant annotation to the graph.
    promoted_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    #: The assistant's evidence: ``{query, record_count, query_language}``.
    evidence: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    anchors: Mapped[list[AnnotationAnchor]] = relationship(
        back_populates="annotation", cascade="all, delete-orphan", lazy="selectin"
    )


class AnnotationAnchor(Base):
    __tablename__ = "annotation_anchors"
    __table_args__ = (Index("ix_annotation_anchors_graph_record", "graph_id", "record_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    annotation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("annotations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    graph_id: Mapped[str] = mapped_column(String(36), nullable=False)
    #: The graph database's element id.
    record_id: Mapped[str] = mapped_column(String(255), nullable=False)

    annotation: Mapped[Annotation] = relationship(back_populates="anchors")
