"""Paths for standards, all under ``/api/v1/standards`` — above Graphs.

=================================================  ==========================================
GET · POST ``""``                                  the library · create (v1 when terms given)
GET ``/{publisher}/{name}``                        one standard with its current terms
GET · POST ``/{publisher}/{name}/versions``        versions · mint the next one
GET ``/{publisher}/{name}/versions/{v}``           one version
POST ``/import/skos``                              a SKOS concept scheme → a standard (or a preview)
=================================================  ==========================================

A dataset claims a standard under ``/api/v1/datasets/{publisher}/{name}/standards``.

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.apps.standards.schemas import (
    SkosImportResult,
    StandardListResponse,
    StandardRead,
    StandardVersionListResponse,
    StandardVersionRead,
)
from invana.server.standards import views

standards_router = APIRouter(prefix="/api/v1/standards", tags=["standards"])

_ONE = "/{publisher}/{name}"

standards_router.get("", response_model=StandardListResponse)(views.list_standards)
standards_router.post("", response_model=StandardRead, status_code=status.HTTP_201_CREATED)(views.create_standard)
standards_router.post("/import/skos", response_model=SkosImportResult)(views.import_skos)
standards_router.get(_ONE, response_model=StandardRead)(views.get_standard)
standards_router.get(f"{_ONE}/versions", response_model=StandardVersionListResponse)(views.list_versions)
standards_router.post(f"{_ONE}/versions", response_model=StandardVersionRead, status_code=status.HTTP_201_CREATED)(
    views.publish_version
)
standards_router.get(f"{_ONE}/versions/{{version}}", response_model=StandardVersionRead)(views.get_version)
