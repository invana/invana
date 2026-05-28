"""Pydantic response schemas for the dataset read API (RFC-020)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel

# ``model_id`` / ``model_version_id`` collide with Pydantic's protected ``model_``
# namespace — opt out so they're plain fields.
_CONFIG = {"from_attributes": True, "protected_namespaces": ()}


class ImportJobSummary(BaseModel):
    id: str
    status: str
    model_version_id: str | None
    records_total: int
    records_processed: int
    error_count: int
    warning_count: int
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime

    model_config = _CONFIG


class ImportJobResponse(ImportJobSummary):
    report: dict[str, Any]
    logs: list[dict[str, Any]]


class DatasetSummary(BaseModel):
    id: str
    graph_id: str
    model_id: str | None
    name: str
    description: str
    record_counts: dict[str, Any]
    last_job_id: str | None
    latest_status: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = _CONFIG


class DatasetResponse(DatasetSummary):
    jobs: list[ImportJobSummary] = []
