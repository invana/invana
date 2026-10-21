"""Paths for a Graph's annotations, all under
``/api/v1/u/{username}/{graphSlug}/annotations``.

Defines no function (migration-plan §4) — path to view, nothing else. Reads are
open to every member; a write's area is ``annotations`` → contributor
(``apps/graphs/roles.py``).
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.apps.annotations.schemas import AnnotationDetail, AnnotationListResponse
from invana.server.annotations import views

annotations_router = APIRouter(
    prefix="/api/v1/u/{username}/{graphSlug}/annotations",
    tags=["annotations"],
)

annotations_router.get("", response_model=AnnotationListResponse)(views.list_annotations)
annotations_router.post("", response_model=AnnotationDetail, status_code=status.HTTP_201_CREATED)(
    views.create_annotation
)
annotations_router.patch("/{annotation_id}", response_model=AnnotationDetail)(views.update_annotation)
annotations_router.delete("/{annotation_id}", status_code=status.HTTP_204_NO_CONTENT)(views.delete_annotation)
