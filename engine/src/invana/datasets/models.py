"""SQLAlchemy async models for dataset ingestion (RFC-020).

- ``datasets``     — a registered dataset (model.json + records) for a Graph.
                     One dataset → one GraphModel (re-import = a new version).
- ``import_jobs``  — one run of importing a dataset (validate → ingest → stitch).

Hard delete, cascade from Graph: ``Graph → Dataset → ImportJob``.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from invana.modeller.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class Dataset(Base):
    __tablename__ = "datasets"
    __table_args__ = (UniqueConstraint("graph_id", "name", name="uq_dataset_graph_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # The model this dataset creates/versions. SET NULL so the dataset row
    # survives if the model is deleted independently.
    model_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("graph_models.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # Where the source files live. ``file://…`` in slice 1; ``s3://…`` once MinIO lands.
    storage_uri: Mapped[str] = mapped_column(String(2048), nullable=False)
    # {"nodes": {"<Type>": n, ...}, "edges": {"<Type>": n, ...}}
    record_counts: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    last_job_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    jobs: Mapped[list[ImportJob]] = relationship(
        back_populates="dataset", cascade="all, delete-orphan", order_by="ImportJob.created_at"
    )


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    dataset_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        Enum("queued", "running", "succeeded", "failed", "cancelled", name="import_job_status_enum"),
        default="queued",
        nullable=False,
    )
    # The GraphVersion this import created/activated. SET NULL on version delete.
    model_version_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("graph_versions.id", ondelete="SET NULL"), nullable=True
    )
    records_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_processed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    warning_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Validation report: list of {file, record_index, record_id, field, rule, message}.
    report: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # Structured log lines: [{ts, level, stage, message}] captured during the run.
    logs: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    dataset: Mapped[Dataset] = relationship(back_populates="jobs")
