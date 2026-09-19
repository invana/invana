"""Paths for Rules — a Graph's invariants and a Project's working rules.

================  ===========================================  =================
GET  POST         ``/rules``                                   a Graph's invariants
GET  POST         ``/projects/{key}/rules``                    a Project's working rules
GET  PATCH        ``/rules/{rule_id}``                         one rule, either scope
POST              ``/rules/{rule_id}/activate``                start offering it
POST              ``/rules/{rule_id}/deactivate``              stop — never a delete
GET               ``/rules/{rule_id}/versions``                what a citation resolves to
GET               ``/rules/{rule_id}/citations``               where it was actually used
================  ===========================================  =================

This file defines **no function** (migration-plan §4) — it maps a path to a
view and nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.apps.skills.schemas import (
    RuleCitationsResponse,
    RuleListResponse,
    RuleRead,
    RuleVersionListResponse,
)
from invana.server.rules import views

rules_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}", tags=["rules"])

rules_router.get("/rules", response_model=RuleListResponse)(views.list_invariants)
rules_router.post("/rules", response_model=RuleRead, status_code=status.HTTP_201_CREATED)(views.create_invariant)
rules_router.get("/projects/{key}/rules", response_model=RuleListResponse)(views.list_working_rules)
rules_router.post(
    "/projects/{key}/rules",
    response_model=RuleRead,
    status_code=status.HTTP_201_CREATED,
)(views.create_working_rule)
rules_router.get("/rules/{rule_id}", response_model=RuleRead)(views.get_rule)
rules_router.patch("/rules/{rule_id}", response_model=RuleRead)(views.update_rule)
rules_router.post("/rules/{rule_id}/activate", response_model=RuleRead)(views.activate_rule)
rules_router.post("/rules/{rule_id}/deactivate", response_model=RuleRead)(views.deactivate_rule)
rules_router.get("/rules/{rule_id}/versions", response_model=RuleVersionListResponse)(views.list_rule_versions)
rules_router.get("/rules/{rule_id}/citations", response_model=RuleCitationsResponse)(views.rule_citations)
