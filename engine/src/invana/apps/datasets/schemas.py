"""Request and response shapes for datasets, their versions and records
(docs/for-developers/modules/bring-data-in/features/datasets.md, Engine)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from invana.apps.datasets.models import AuthorKind, AuthorRole, Origin, Sensitivity, Visibility
from invana.apps.standards.models import Enforcement

SLUG = r"^[a-z0-9][a-z0-9-]{0,62}$"


class AuthorStep(BaseModel):
    role: AuthorRole
    kind: AuthorKind
    name: str = Field(..., min_length=1, max_length=255)
    ref: str | None = Field(default=None, max_length=1000)
    result: str | None = Field(default=None, max_length=500)


class DatasetCreate(BaseModel):
    #: Defaults to the creator's username.
    publisher: str | None = Field(default=None, pattern=SLUG)
    name: str = Field(..., pattern=SLUG)
    title: str = Field(default="", max_length=255)
    description: str = Field(default="")
    origin: Origin
    key_column: str = Field(default="id", min_length=1, max_length=255)
    sensitivity: Sensitivity = Sensitivity.internal
    column_sensitivity: dict[str, Sensitivity] = Field(default_factory=dict)


class DatasetUpdate(BaseModel):
    """Metadata. None of it is a version; an omitted field is unchanged."""

    title: str | None = Field(default=None, max_length=255)
    description: str | None = None
    visibility: Visibility | None = None
    sensitivity: Sensitivity | None = None
    column_sensitivity: dict[str, Sensitivity] | None = None
    #: An empty string clears the schedule.
    refresh_schedule: str | None = Field(default=None, max_length=128)
    refresh_source: str | None = Field(default=None, max_length=1000)


class DatasetVersionCreate(BaseModel):
    licence: str = Field(..., min_length=1, max_length=255)
    author_chain: list[AuthorStep] = Field(default_factory=list)
    records: list[dict[str, Any]] = Field(..., min_length=1)
    source: str | None = Field(default=None, max_length=1000)
    #: ``publisher/name@v`` of each input version.
    derived_from: list[str] = Field(default_factory=list)
    why: str | None = Field(default=None, max_length=500)


class Retraction(BaseModel):
    at: datetime
    by_id: str | None
    reason: str | None


class DatasetRetract(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)


class DatasetVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    dataset_id: str
    address: str
    version: int
    content_hash: str
    licence: str
    author_chain: list[dict[str, Any]]
    columns: list[str]
    record_count: int
    source: str | None
    derived_from: list[str]
    why: str | None
    published_by_id: str | None
    published_at: datetime
    retracted: Retraction | None
    #: The inputs in ``derived_from`` that are retracted, by address.
    retracted_inputs: list[str] = []
    #: What the act that minted it was warned of; empty on a plain read.
    warnings: list[str] = []


class DatasetVersionListResponse(BaseModel):
    items: list[DatasetVersionRead]
    total: int


class DatasetRead(BaseModel):
    id: str
    address: str
    publisher: str
    name: str
    title: str
    description: str
    origin: str
    key_column: str
    visibility: str
    sensitivity: str
    column_sensitivity: dict[str, str]
    refresh_schedule: str | None
    refresh_source: str | None
    created_by_id: str | None
    created_at: datetime
    updated_at: datetime
    current_version: int | None
    licence: str | None
    author_chain: list[dict[str, Any]]
    record_count: int
    content_hash: str | None
    #: What the act that returned it was warned of; empty on a plain read.
    warnings: list[str] = []


class DatasetListResponse(BaseModel):
    items: list[DatasetRead]
    total: int


class DatasetRecordRead(BaseModel):
    key: str
    version: int
    values: dict[str, Any]
    provenance: dict[str, Any] | None


class DatasetRecordPage(BaseModel):
    address: str
    items: list[DatasetRecordRead]
    total: int
    offset: int
    limit: int


class PropertyChange(BaseModel):
    property: str
    before: Any = None
    after: Any = None


class RecordChange(BaseModel):
    version: int
    at: datetime
    actor_id: str | None
    why: str | None
    kind: Literal["added", "changed", "removed"]
    properties: list[PropertyChange]


class RecordChangeLog(BaseModel):
    address: str
    key: str
    items: list[RecordChange]


class DatasetVersionRef(BaseModel):
    address: str
    version_id: str
    dataset_id: str


class DatasetBindingCreate(BaseModel):
    #: ``publisher/name@v`` — always an exact version.
    dataset: str = Field(..., min_length=3, max_length=200)
    model: str = Field(..., min_length=1, max_length=36)
    type: str = Field(..., min_length=1, max_length=255)


class DatasetBindingRead(BaseModel):
    id: str
    graph_id: str
    model_id: str
    model_name: str | None
    type_name: str
    #: ``publisher/name@v`` of the bound version.
    address: str
    version: int
    run_id: str | None
    bound_by_id: str | None
    bound_at: datetime
    retracted: Retraction | None
    #: The dataset's current version, while it is newer than the bound one.
    newer_version: int | None = None
    #: What the bind was warned of; empty on a plain read.
    warnings: list[str] = []


class DatasetBindingListResponse(BaseModel):
    items: list[DatasetBindingRead]
    total: int


class DatasetVersionUsage(BaseModel):
    """Where one version is cited — read, never stored."""

    address: str
    retracted: Retraction | None
    bindings: list[DatasetBindingRead]
    derived: list[DatasetVersionRef]


class DatasetStandardCreate(BaseModel):
    """Claim a standard: ``publisher/name[@v]`` — the current version when none is named."""

    standard: str = Field(..., min_length=3, max_length=200)
    mode: Enforcement = Enforcement.warn
    #: ``{term: column}``; omitted, every term maps to the column of its name.
    mapping: dict[str, str] | None = None


class Violation(BaseModel):
    key: str
    term: str
    kind: Literal["missing", "not_allowed", "wrong_type"]
    value: Any = None


class ConformanceRead(BaseModel):
    """One dataset version scored against one standard version."""

    #: ``publisher/name@v`` of the dataset version.
    dataset: str
    #: ``publisher/name@v`` of the standard version.
    standard: str
    mode: Enforcement
    record_count: int
    conforming: int
    score: float
    conforms: bool
    violation_count: int
    #: The first 50; ``violation_count`` is the whole.
    violations: list[Violation]
    checked_at: datetime


class ConformanceListResponse(BaseModel):
    items: list[ConformanceRead]
    total: int


class DatasetStandardRead(BaseModel):
    """A standard a dataset claims, pinned to one version."""

    #: ``publisher/name@v``.
    standard: str
    version: int
    #: The standard's current version, while it is newer than the pinned one.
    newer_version: int | None = None
    mode: Enforcement
    mapping: dict[str, str]
    attached_by_id: str | None
    attached_at: datetime
    #: The current dataset version's score; null before the first version.
    conformance: ConformanceRead | None = None


class DatasetStandardListResponse(BaseModel):
    items: list[DatasetStandardRead]
    total: int
    #: The lowest current-version score across the claims; null when none is scored.
    lowest_score: float | None = None


class DatasetClaim(BaseModel):
    """One standard one dataset claims."""

    dataset: DatasetRead
    attachment: DatasetStandardRead


class DatasetClaimListResponse(BaseModel):
    """Every claim on every dataset the reader may read."""

    items: list[DatasetClaim]
    total: int
    #: Claims per standard, by its unversioned address.
    by_standard: dict[str, int]
    #: Datasets whose claims could not be read.
    unreadable: int = 0


class ValidationItem(BaseModel):
    """One violation on a dataset's current version."""

    #: ``publisher/name`` of the dataset.
    dataset: str
    #: ``publisher/name@v`` of the claimed standard version.
    standard: str
    mode: Enforcement
    #: The column the term is mapped to; the term itself when unmapped.
    column: str
    violation: Violation


class ValidationDataset(BaseModel):
    """A dataset with something to review."""

    address: str
    publisher: str
    name: str
    title: str
    #: Its violations across every claim, beyond the 50 a claim keeps.
    total: int


class ValidationQueue(BaseModel):
    """The validation queue across every dataset the reader may read."""

    #: The violations each claim keeps, at most 50 per claim.
    items: list[ValidationItem]
    #: Every violation to review, counted from ``violation_count``.
    total: int
    datasets: list[ValidationDataset]
    #: Datasets whose claims could not be read.
    unreadable: int = 0
