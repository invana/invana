"""The dataset record — install-wide, versioned tables from one source.

A **dataset** is tables from one source under one authorship, kept above
Graphs (docs/for-developers/modules/bring-data-in/features/datasets.md). It is
addressed ``publisher/name``; its **versions** are immutable and hashed, and
each version holds its own **records**. A Graph never owns a dataset: it binds
one exact version into one of its models, and that binding is the only row
here with a ``graph_id``.

=====================  ====================================================
table                  holds
=====================  ====================================================
``datasets``           the address, origin, visibility, sensitivity, schedule
``dataset_versions``   licence, author chain, columns, hash — immutable
``dataset_records``    one keyed row of one version
``dataset_bindings``   a version bound into a Graph's model
``dataset_standards``  a standard the dataset claims, pinned to one version
``dataset_conformance`` a version's score against a standard version
=====================  ====================================================

Retraction marks a version and never deletes it, so nothing here cascades
from a version to the bindings that cite it: a version is not deleted at all.
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from invana.apps.standards import models as _standards  # noqa: F401 — the tables a claim points at
from invana.core.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class Origin(enum.StrEnum):
    """Where a dataset came from, and so who its author is."""

    official = "official"
    collected = "collected"
    generated = "generated"
    observed = "observed"
    derived = "derived"


class Visibility(enum.StrEnum):
    private = "private"
    install = "install"


class Sensitivity(enum.StrEnum):
    """Ordered loosest first — a column may be tighter than its dataset, never looser."""

    public = "public"
    internal = "internal"
    confidential = "confidential"
    personal = "personal"

    @property
    def rank(self) -> int:
        return list(Sensitivity).index(self)


class AuthorRole(enum.StrEnum):
    original = "original"
    collected_by = "collected_by"
    modified_by = "modified_by"
    validated_by = "validated_by"


class AuthorKind(enum.StrEnum):
    organisation = "organisation"
    page = "page"
    person = "person"
    agent = "agent"
    run = "run"


class Dataset(Base):
    """One dataset, addressed ``publisher/name``. Its content is its versions."""

    __tablename__ = "datasets"
    __table_args__ = (UniqueConstraint("publisher", "name", name="uq_dataset_address"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    publisher: Mapped[str] = mapped_column(String(63), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(63), nullable=False)
    title: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    #: Set at create, never changed; records inherit it.
    origin: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    #: The column every record is keyed by.
    key_column: Mapped[str] = mapped_column(String(255), default="id", nullable=False)
    visibility: Mapped[str] = mapped_column(String(16), default=Visibility.private.value, nullable=False)
    sensitivity: Mapped[str] = mapped_column(String(16), default=Sensitivity.internal.value, nullable=False)
    #: ``{column: label}`` — each at least as tight as ``sensitivity``.
    column_sensitivity: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    #: A 5-field cron; null when the dataset does not refresh.
    refresh_schedule: Mapped[str | None] = mapped_column(String(128), nullable=True)
    #: The path a refresh reads. Read by the CLI, never by an HTTP request.
    refresh_source: Mapped[str | None] = mapped_column(Text, nullable=True)
    current_version_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("dataset_versions.id", ondelete="SET NULL", use_alter=True, name="fk_datasets_current_version"),
        nullable=True,
    )
    created_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    @property
    def address(self) -> str:
        return f"{self.publisher}/{self.name}"


class DatasetVersion(Base):
    """One published version. **Immutable** — only the retraction mark is ever set later."""

    __tablename__ = "dataset_versions"
    __table_args__ = (UniqueConstraint("dataset_id", "version", name="uq_dataset_version_number"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    dataset_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    #: ``draft`` until its owner publishes it; a draft is never current and no binding cites it.
    state: Mapped[str] = mapped_column(String(16), nullable=False, default="published", server_default="published")
    #: ``sha256:<hex>`` over the records in key order.
    content_hash: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    licence: Mapped[str] = mapped_column(String(255), nullable=False)
    #: ``[{role, kind, name, ref?, result?}]``, original authors first.
    author_chain: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    #: Column names in first-seen order.
    columns: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    record_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    #: A file name or URL the content was read from; informational.
    source: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: Ids of the input versions this one was derived from.
    derived_from: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    why: Mapped[str | None] = mapped_column(String(500), nullable=True)
    published_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    retracted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    retracted_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    retraction_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)


class DatasetRecord(Base):
    """One keyed row of one version."""

    __tablename__ = "dataset_records"
    __table_args__ = (UniqueConstraint("version_id", "key", name="uq_dataset_record_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    version_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("dataset_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    key: Mapped[str] = mapped_column(String(255), nullable=False)
    #: ``{column: scalar}``.
    values: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    #: ``{origin?, source?, note?}`` where the record differs from its dataset; else null.
    provenance: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class DatasetBinding(Base):
    """One dataset version bound into one model of one Graph, as one node type."""

    __tablename__ = "dataset_bindings"
    __table_args__ = (
        UniqueConstraint("graph_id", "model_id", "dataset_id", "type_name", name="uq_dataset_binding_target"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    model_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graph_models.id", ondelete="CASCADE"), nullable=False, index=True
    )
    dataset_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    dataset_version_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("dataset_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type_name: Mapped[str] = mapped_column(String(255), nullable=False)
    #: The load run of the latest bind.
    run_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("task_runs.id", ondelete="SET NULL"), nullable=True
    )
    bound_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    bound_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class DatasetStandard(Base):
    """A standard one dataset claims — one pinned version, a mapping, a mode."""

    __tablename__ = "dataset_standards"
    __table_args__ = (UniqueConstraint("dataset_id", "standard_id", name="uq_dataset_standard"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    dataset_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    standard_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("standards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: Pinned; a newer standard version never moves it.
    standard_version_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("standard_versions.id", ondelete="CASCADE"), nullable=False
    )
    #: ``block · warn · report``.
    mode: Mapped[str] = mapped_column(String(8), nullable=False)
    #: ``{term: column}``.
    mapping: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    attached_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    attached_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class DatasetConformance(Base):
    """One dataset version scored against one standard version. Derived — recomputed in place."""

    __tablename__ = "dataset_conformance"
    __table_args__ = (
        UniqueConstraint("dataset_version_id", "standard_version_id", name="uq_dataset_conformance_pair"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    dataset_version_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("dataset_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    standard_version_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("standard_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: The mapping it was scored under.
    mapping: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    record_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    conforming: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    score: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    violation_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    #: ``[{key, term, kind, value?}]`` — the first 50.
    violations: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
