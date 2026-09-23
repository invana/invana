"""Paths for Govern, all under ``/api/v1/u/{username}/{graphSlug}/govern``.

==========================================  ==================================
GET · POST ``/lenses``                      the drawer · a new world or guardrail
GET · PATCH · DELETE ``/lenses/{id}``       detail · edit (naming publishes) · delete
POST ``/lenses/{id}/promote``               world → guardrail. One field
POST ``/lenses/{id}/duplicate``             a private copy, unnamed
POST ``/lenses/validate``                   what a save would be refused for
POST ``/lenses/impact``                     what a guardrail save would cost
GET  ``/participants``                      the catalogue · what a rule matches
GET  ``/runs/{run_id}/touches``             what the run engaged, in seq order
GET  ``/compare``                           two runs, side by side
==========================================  ==================================

``kind`` filters the list rather than two paths doing it: a world and a
guardrail are one row separated by that field, and two endpoints would be the
second enforcement path this module exists not to have.

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.apps.govern.schemas import (
    CatalogueRead,
    CompareRead,
    ImpactRead,
    LensListResponse,
    LensRead,
    TouchesRead,
    ValidationRead,
)
from invana.server.govern import views

govern_router = APIRouter(
    prefix="/api/v1/u/{username}/{graphSlug}/govern",
    tags=["govern"],
)

govern_router.get("/lenses", response_model=LensListResponse)(views.list_lenses)
govern_router.post("/lenses", response_model=LensRead, status_code=status.HTTP_201_CREATED)(views.create_lens)
govern_router.post("/lenses/validate", response_model=ValidationRead)(views.validate_lens)
govern_router.post("/lenses/impact", response_model=ImpactRead)(views.guardrail_impact)
govern_router.get("/lenses/{lens_id}", response_model=LensRead)(views.get_lens)
govern_router.patch("/lenses/{lens_id}", response_model=LensRead)(views.update_lens)
govern_router.delete("/lenses/{lens_id}", status_code=status.HTTP_204_NO_CONTENT)(views.delete_lens)
govern_router.post("/lenses/{lens_id}/promote", response_model=LensRead)(views.promote_lens)
govern_router.post("/lenses/{lens_id}/duplicate", response_model=LensRead, status_code=status.HTTP_201_CREATED)(
    views.duplicate_lens
)
govern_router.get("/participants", response_model=CatalogueRead)(views.list_participants)
govern_router.get("/runs/{run_id}/touches", response_model=TouchesRead)(views.list_touches)
govern_router.get("/compare", response_model=CompareRead)(views.compare_runs)
