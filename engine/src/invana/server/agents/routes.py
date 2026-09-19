"""Paths for the agent roster.

``/api/v1/u/{username}/{graphSlug}/agents`` — the roster
``/api/v1/u/{username}/{graphSlug}``        — the Graph's default agent

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.apps.agents.schemas import (
    AgentLineageResponse,
    AgentListResponse,
    AgentRead,
    RetirePreview,
)
from invana.core.events.schemas import EventListResponse
from invana.server.agents import views

agents_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/agents", tags=["agents"])
atlas_agent_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}", tags=["agents"])

agents_router.get("", response_model=AgentListResponse)(views.list_agents)
agents_router.post("", response_model=AgentRead, status_code=status.HTTP_201_CREATED)(views.create_agent)
agents_router.get("/{agent_id}", response_model=AgentRead)(views.get_agent)
agents_router.patch("/{agent_id}", response_model=AgentRead)(views.update_agent)
agents_router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)(views.delete_agent)
agents_router.post("/{agent_id}/pause", response_model=AgentRead)(views.pause_agent)
agents_router.post("/{agent_id}/resume", response_model=AgentRead)(views.resume_agent)
agents_router.get("/{agent_id}/retire", response_model=RetirePreview)(views.preview_retire)
agents_router.post("/{agent_id}/retire", response_model=AgentRead)(views.retire_agent)
agents_router.get("/{agent_id}/lineage", response_model=AgentLineageResponse)(views.agent_lineage)
agents_router.get("/{agent_id}/activity", response_model=EventListResponse)(views.agent_activity)

atlas_agent_router.post("/default-agent", response_model=AgentRead)(views.set_default_agent)
