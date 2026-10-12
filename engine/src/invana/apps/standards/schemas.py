"""Request and response shapes for standards and their versions
(docs/for-developers/modules/bring-data-in/features/standards.md, Engine)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from invana.apps.semantic.reader import MAX_CONTENT_CHARS, RdfFormat
from invana.apps.semantic.schemas import SkosReport
from invana.apps.standards.models import StandardOrigin, TermType

SLUG = r"^[a-z0-9][a-z0-9-]{0,62}$"


class TermValue(BaseModel):
    code: str = Field(..., min_length=1, max_length=255)
    label: str | None = Field(default=None, max_length=255)
    #: The source IRI, set by a SKOS import.
    iri: str | None = Field(default=None, max_length=2048)
    #: The code of the value above this one in the same term.
    broader: str | None = Field(default=None, max_length=255)


class StandardTerm(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: TermType = TermType.text
    required: bool = False
    #: The allowed codes; omitted, any value of the type conforms.
    values: list[TermValue] | None = None
    description: str | None = None
    #: The source IRI, set by a SKOS import.
    iri: str | None = Field(default=None, max_length=2048)


class StandardCreate(BaseModel):
    #: Defaults to the creator's username.
    publisher: str | None = Field(default=None, pattern=SLUG)
    name: str = Field(..., pattern=SLUG)
    title: str = Field(default="", max_length=255)
    description: str = Field(default="")
    origin: StandardOrigin = StandardOrigin.authored
    #: Given, they mint v1 in the same act.
    terms: list[StandardTerm] | None = None
    why: str | None = Field(default=None, max_length=500)


class StandardVersionCreate(BaseModel):
    terms: list[StandardTerm] = Field(..., min_length=1)
    why: str | None = Field(default=None, max_length=500)


class StandardVersionRead(BaseModel):
    id: str
    standard_id: str
    #: ``publisher/name@v``.
    address: str
    version: int
    terms: list[StandardTerm]
    content_hash: str
    why: str | None
    published_by_id: str | None
    published_at: datetime


class StandardVersionListResponse(BaseModel):
    items: list[StandardVersionRead]
    total: int


class StandardRead(BaseModel):
    """The standard with its current version's terms flattened in."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    address: str
    publisher: str
    name: str
    title: str
    description: str
    origin: StandardOrigin
    current_version: int | None
    terms: list[StandardTerm]
    content_hash: str | None
    created_by_id: str | None
    created_at: datetime
    updated_at: datetime


class StandardListResponse(BaseModel):
    items: list[StandardRead]
    total: int


class SkosImportRequest(BaseModel):
    """A SKOS vocabulary's text — the engine never fetches a URL."""

    content: str = Field(..., min_length=1, max_length=MAX_CONTENT_CHARS)
    #: Omitted, detected from the text.
    format: RdfFormat | None = None
    #: The concept scheme's IRI; needed when the file holds several.
    scheme: str | None = Field(default=None, max_length=2048)
    #: Defaults to the importer's username.
    publisher: str | None = Field(default=None, pattern=SLUG)
    #: Defaults to the scheme's slug.
    name: str | None = Field(default=None, pattern=SLUG)
    lang: str = Field(default="en", min_length=2, max_length=16)
    why: str | None = Field(default=None, max_length=500)
    dry_run: bool = False


class SkosImportResult(BaseModel):
    #: ``publisher/name`` the import writes to — or would.
    address: str
    scheme_iri: str | None
    title: str
    terms: list[StandardTerm]
    #: Absent on a dry run.
    standard: StandardRead | None = None
    #: Absent on a dry run, and when the terms were unchanged.
    version: StandardVersionRead | None = None
    #: The terms match the current version; nothing was written.
    unchanged: bool = False
    report: SkosReport
