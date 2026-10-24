"""Paths for a Graph's schedules — ``/api/v1/u/{username}/{graphSlug}/schedules``.

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.activity.schemas import FiringListResponse, FiringRead, SchedulePage, ScheduleRead
from invana.server.schedules import views

schedules_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/schedules", tags=["schedules"])

schedules_router.get("", response_model=SchedulePage)(views.list_schedules)
schedules_router.post("", response_model=ScheduleRead, status_code=status.HTTP_201_CREATED)(views.create_schedule)
schedules_router.get("/{schedule_id}", response_model=ScheduleRead)(views.get_schedule)
schedules_router.patch("/{schedule_id}", response_model=ScheduleRead)(views.update_schedule)
schedules_router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)(views.delete_schedule)
schedules_router.post("/{schedule_id}/pause", response_model=ScheduleRead)(views.pause_schedule)
schedules_router.post("/{schedule_id}/resume", response_model=ScheduleRead)(views.resume_schedule)
schedules_router.post("/{schedule_id}/run", response_model=FiringRead, status_code=status.HTTP_202_ACCEPTED)(
    views.run_schedule
)
schedules_router.get("/{schedule_id}/firings", response_model=FiringListResponse)(views.list_firings)

__all__ = ["schedules_router"]
