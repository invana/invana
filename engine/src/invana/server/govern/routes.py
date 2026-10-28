"""Paths for Govern, all under ``/api/v1/u/{username}/{graphSlug}/govern``.

==========================================  ==================================
GET · POST ``/lenses``                      the drawer · a new world or guardrail
GET · PATCH · DELETE ``/lenses/{id}``       detail · edit (naming publishes) · delete
GET  ``/lenses/{id}/usage``                 runs, the last 30 days, the agents that asked
POST ``/lenses/{id}/duplicate``             a private copy, unnamed
POST ``/lenses/validate``                   what a save would be refused for
POST ``/lenses/impact``                     what a guardrail save would cost
GET · POST ``/guardrails``                  the Graph's property rules · a new one
GET · PATCH · DELETE ``/guardrails/{id}``   the inspector · edit · delete
GET  ``/guardrails/targets``                every ``Type.property`` the picker offers
POST ``/guardrails/impact``                 what a rule would change, before the save
GET  ``/view?world=``                       a world, or the guardrails alone, on the model
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
    GuardrailDetail,
    GuardrailImpactRead,
    GuardrailPage,
    GuardrailTargetRead,
    ImpactRead,
    LensListResponse,
    LensRead,
    LensUsageRead,
    LensView,
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
govern_router.post("/lenses/{lens_id}/duplicate", response_model=LensRead, status_code=status.HTTP_201_CREATED)(
    views.duplicate_lens
)
govern_router.get("/lenses/{lens_id}/usage", response_model=LensUsageRead)(views.lens_usage)
govern_router.get("/guardrails", response_model=GuardrailPage)(views.list_guardrails)
govern_router.post("/guardrails", response_model=GuardrailDetail, status_code=status.HTTP_201_CREATED)(
    views.create_guardrail
)
govern_router.get("/guardrails/targets", response_model=list[GuardrailTargetRead])(views.guardrail_targets)
govern_router.post("/guardrails/impact", response_model=GuardrailImpactRead)(views.guardrail_rule_impact)
govern_router.get("/guardrails/{guardrail_id}", response_model=GuardrailDetail)(views.get_guardrail)
govern_router.patch("/guardrails/{guardrail_id}", response_model=GuardrailDetail)(views.update_guardrail)
govern_router.delete("/guardrails/{guardrail_id}", status_code=status.HTTP_204_NO_CONTENT)(views.delete_guardrail)
govern_router.get("/view", response_model=LensView)(views.lens_view)
govern_router.get("/participants", response_model=CatalogueRead)(views.list_participants)
govern_router.get("/runs/{run_id}/touches", response_model=TouchesRead)(views.list_touches)
govern_router.get("/compare", response_model=CompareRead)(views.compare_runs)
