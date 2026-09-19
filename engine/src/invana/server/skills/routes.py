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
GET           ``/{id}/usage``  carried · offered · reported
============  ==========  =================

This file defines **no function** (migration-plan §4) — it maps a path to a
view and nothing else, so the route table is readable in one screen.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.apps.agents.schemas import SkillUsageResponse
from invana.apps.skills.schemas import (
    SkillListResponse,
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
skills_router.get("/{skill_id}", response_model=SkillRead)(views.get_skill)
skills_router.patch("/{skill_id}", response_model=SkillRead)(views.update_skill)
skills_router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)(views.delete_skill)
skills_router.get("/{skill_id}/versions", response_model=SkillVersionListResponse)(views.list_skill_versions)
skills_router.post(
    "/{skill_id}/versions",
    response_model=SkillVersionRead,
    status_code=status.HTTP_201_CREATED,
)(views.publish_skill_version)
skills_router.get("/{skill_id}/versions/{version}", response_model=SkillVersionRead)(views.get_skill_version)
skills_router.get("/{skill_id}/versions/{version}/diff", response_model=SkillVersionDiff)(views.diff_skill_version)
skills_router.get("/{skill_id}/usage", response_model=SkillUsageResponse)(views.skill_usage)
