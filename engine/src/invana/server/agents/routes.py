"""Paths for the agents list.

``/api/v1/u/{username}/{graphSlug}/agents`` — the list
``/api/v1/u/{username}/{graphSlug}``        — the Graph's default agent

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.activity.schemas import FleetOverview, FleetPerformance
from invana.apps.agents.schemas import (
    AgentLineageResponse,
    AgentMeters,
    AgentOverview,
    AgentPage,
    AgentRead,
    AgentSkillsAndCallables,
    LifecyclePreview,
    SoulPreviewResponse,
)
from invana.core.events.schemas import EventListResponse
from invana.server.agents import views

agents_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/agents", tags=["agents"])
atlas_agent_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}", tags=["agents"])

agents_router.get("", response_model=AgentPage)(views.list_agents)
# Before `/{agent_id}`, which would read `overview` as an id.
agents_router.get("/overview", response_model=FleetOverview)(views.fleet_overview)
agents_router.get("/performance", response_model=FleetPerformance)(views.fleet_performance)
agents_router.post("", response_model=AgentRead, status_code=status.HTTP_201_CREATED)(views.create_agent)
agents_router.get("/{agent_id}", response_model=AgentRead)(views.get_agent)
agents_router.patch("/{agent_id}", response_model=AgentRead)(views.update_agent)
agents_router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)(views.delete_agent)
agents_router.patch("/{agent_id}/draft", response_model=AgentRead)(views.write_agent_draft)
agents_router.delete("/{agent_id}/draft", response_model=AgentRead)(views.discard_agent_draft)
agents_router.post("/{agent_id}/create", response_model=AgentRead)(views.make_agent_live)
agents_router.get("/{agent_id}/overview", response_model=AgentOverview)(views.agent_overview)
agents_router.post("/{agent_id}/publish", response_model=AgentRead)(views.publish_agent_instructions)
agents_router.post("/{agent_id}/rollback", response_model=AgentRead)(views.rollback_agent_instructions)
# GET previews the act, POST performs it — the same pair on both acts that
# disturb open work (LC8 · LC10). Resume has no GET: it takes nothing away.
agents_router.get("/{agent_id}/pause", response_model=LifecyclePreview)(views.preview_pause)
agents_router.post("/{agent_id}/pause", response_model=AgentRead)(views.pause_agent)
agents_router.post("/{agent_id}/resume", response_model=AgentRead)(views.resume_agent)
agents_router.get("/{agent_id}/retire", response_model=LifecyclePreview)(views.preview_retire)
agents_router.post("/{agent_id}/retire", response_model=AgentRead)(views.retire_agent)
agents_router.get("/{agent_id}/lineage", response_model=AgentLineageResponse)(views.agent_lineage)
agents_router.get("/{agent_id}/activity", response_model=EventListResponse)(views.agent_activity)
agents_router.get("/{agent_id}/meters", response_model=AgentMeters)(views.agent_meters)
agents_router.get("/{agent_id}/skills-and-callables", response_model=AgentSkillsAndCallables)(
    views.skills_and_callables
)
agents_router.post("/{agent_id}/soul/preview", response_model=SoulPreviewResponse)(views.preview_soul)
agents_router.post("/{agent_id}/skills/{skill_id}", response_model=AgentRead)(views.bind_skill)
agents_router.delete("/{agent_id}/skills/{skill_id}", response_model=AgentRead)(views.unbind_skill)

atlas_agent_router.post("/default-agent", response_model=AgentRead)(views.set_default_agent)
