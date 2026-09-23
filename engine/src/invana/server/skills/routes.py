"""Paths for graph-scoped Skills, all under
``/api/v1/u/{username}/{graphSlug}/skills``.

============  ==========  =================
GET           ``""``      list
POST          ``""``      create
GET           ``/{id}``   detail
PATCH         ``/{id}``   update
DELETE        ``/{id}``   hard delete
GET           ``/{id}/versions``  the published history, newest first
POST          ``/{id}/versions``  publish the next version
GET           ``/{id}/versions/{version}``  one version by number
GET           ``/{id}/versions/{version}/diff``  against the one before it
PATCH         ``/{id}/draft/tasks``  hand-edit the draft's plan
GET           ``/inlinable``  the library plans a skill may inline
GET           ``/{id}/agents``  bound · refused · not bound, refusals dry-run
GET           ``/{id}/usage``  carried · offered · reported
============  ==========  =================

This file defines **no function** (migration-plan §4) — it maps a path to a
view and nothing else, so the route table is readable in one screen.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.apps.agents.schemas import SkillUsageResponse
from invana.apps.skills.schemas import (
    InlinablePlanListResponse,
    SkillAgentsResponse,
    SkillDraftRead,
    SkillDrawStarted,
    SkillListResponse,
    SkillPlanRead,
    SkillRead,
    SkillVersionDiff,
    SkillVersionListResponse,
    SkillVersionRead,
)
from invana.server.skills import views

skills_router = APIRouter(
    prefix="/api/v1/u/{username}/{graphSlug}/skills",
    tags=["skills"],
)

skills_router.get("", response_model=SkillListResponse)(views.list_skills)
skills_router.post("", response_model=SkillRead, status_code=status.HTTP_201_CREATED)(views.create_skill)
# Before `/{skill_id}`-shaped paths would swallow it: `inlinable` is a word, not an id.
skills_router.get("/inlinable", response_model=InlinablePlanListResponse)(views.inlinable_plans)
skills_router.get("/{skill_id}", response_model=SkillRead)(views.get_skill)
skills_router.patch("/{skill_id}", response_model=SkillRead)(views.update_skill)
skills_router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)(views.delete_skill)
skills_router.get("/{skill_id}/versions", response_model=SkillVersionListResponse)(views.list_skill_versions)
skills_router.post(
    "/{skill_id}/versions",
    response_model=SkillVersionRead,
    status_code=status.HTTP_201_CREATED,
)(views.publish_skill_version)
skills_router.get("/{skill_id}/draft", response_model=SkillDraftRead)(views.get_skill_draft)
skills_router.patch("/{skill_id}/draft", response_model=SkillDraftRead)(views.update_skill_draft)
skills_router.delete("/{skill_id}/draft", status_code=status.HTTP_204_NO_CONTENT)(views.discard_skill_draft)
skills_router.patch("/{skill_id}/draft/tasks", response_model=SkillDraftRead)(views.write_skill_draft_tasks)
skills_router.post("/{skill_id}/draft/draw", response_model=SkillDrawStarted, status_code=status.HTTP_202_ACCEPTED)(
    views.draw_skill_draft
)
skills_router.post(
    "/{skill_id}/draft/clarifications/{clarification_id}",
    response_model=SkillDraftRead,
)(views.answer_clarification)
skills_router.get("/{skill_id}/versions/{version}", response_model=SkillVersionRead)(views.get_skill_version)
skills_router.get("/{skill_id}/versions/{version}/tasks", response_model=SkillPlanRead)(views.skill_version_plan)
skills_router.get("/{skill_id}/versions/{version}/diff", response_model=SkillVersionDiff)(views.diff_skill_version)
skills_router.get("/{skill_id}/agents", response_model=SkillAgentsResponse)(views.skill_agents)
skills_router.get("/{skill_id}/usage", response_model=SkillUsageResponse)(views.skill_usage)
