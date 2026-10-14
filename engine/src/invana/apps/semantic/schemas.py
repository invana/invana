"""Import reports and the ontology import's request and result shapes
(docs/for-developers/modules/connect-and-model/features/ontology-import.md,
docs/for-developers/modules/bring-data-in/features/skos-import.md — Engine)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from invana.apps.modeller.schemas import GraphModelResponse, SchemaExport, VersionResponse
from invana.apps.semantic.reader import MAX_CONTENT_CHARS, MAX_LISTED, RdfFormat


class ImportNote(BaseModel):
    """One thing an import skipped, or did in a way worth saying."""

    iri: str | None = None
    #: What it concerns — a type, a property, a term.
    subject: str
    #: A short code: ``restriction`` · ``no_domain`` · ``flattened`` · ``duplicate_code`` …
    kind: str
    message: str


class NoteList:
    """Collects notes, keeping the first ``MAX_LISTED`` and counting them all."""

    def __init__(self) -> None:
        self.items: list[ImportNote] = []
        self.count = 0

    def add(self, *, subject: str, kind: str, message: str, iri: str | None = None) -> None:
        self.count += 1
        if len(self.items) < MAX_LISTED:
            self.items.append(ImportNote(iri=iri, subject=subject, kind=kind, message=message))


class StitchSuggestion(BaseModel):
    kind: Literal["same_as", "equivalent_class", "equivalent_property"]
    #: The imported type or property's name.
    name: str
    iri: str
    target_iri: str


class InheritedProperty(BaseModel):
    property: str
    from_type: str


class MappedType(BaseModel):
    name: str
    iri: str
    kind: Literal["node", "edge"]
    #: ``Person.birthPlace`` — the property that brought an unpicked type in.
    came_with: str | None = None
    properties: list[str] = []
    inherited: list[InheritedProperty] = []


class SkosReport(BaseModel):
    format: RdfFormat
    triples: int
    #: ``{"terms": 3, "values": 41}``.
    mapped: dict[str, int]
    skipped: list[ImportNote] = []
    skipped_count: int = 0
    notes: list[ImportNote] = []
    notes_count: int = 0


class OntologyReport(BaseModel):
    format: RdfFormat
    triples: int
    #: ``{"node_types": 4, "edge_types": 3, "property_keys": 12}``.
    mapped: dict[str, int]
    types: list[MappedType] = []
    skipped: list[ImportNote] = []
    skipped_count: int = 0
    notes: list[ImportNote] = []
    notes_count: int = 0
    suggestions: list[StitchSuggestion] = []


class OntologyImportRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=MAX_CONTENT_CHARS)
    #: Omitted, detected from the text.
    format: RdfFormat | None = None
    #: Class names, local names or IRIs; omitted, every class.
    types: list[str] | None = None
    #: The model's name in this Graph; omitted, the ontology's label.
    name: str | None = Field(default=None, max_length=255)
    lang: str = Field(default="en", min_length=2, max_length=16)
    dry_run: bool = False


class OntologyImportResult(BaseModel):
    #: Absent on a dry run.
    model: GraphModelResponse | None = None
    version: VersionResponse | None = None
    #: The draft it creates — or would.
    draft: SchemaExport
    report: OntologyReport
    unsupported_property_types: list[dict[str, str]] = []
    publishable: bool = True
