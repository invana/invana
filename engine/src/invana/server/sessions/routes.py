"""Paths for Ask sessions, under ``/api/v1/u/{username}/{graphSlug}/sessions``.

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.apps.sessions.schemas import (
    OperationResponse,
    RerunResponse,
    SendMessageResponse,
    SessionContextTurn,
    SessionDetail,
    SessionListResponse,
    SessionMessageRead,
    SessionSummary,
)
from invana.server.sessions import views

sessions_router = APIRouter(
    prefix="/api/v1/u/{username}/{graphSlug}/sessions",
    tags=["sessions"],
)

sessions_router.get("", response_model=SessionListResponse)(views.list_sessions)
sessions_router.post("", response_model=SessionDetail, status_code=status.HTTP_201_CREATED)(views.create_session)
sessions_router.get("/{session_id}", response_model=SessionDetail)(views.get_session_detail)
sessions_router.patch("/{session_id}", response_model=SessionSummary)(views.update_session)
sessions_router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)(views.delete_session)
sessions_router.post(
    "/{session_id}/messages", response_model=SendMessageResponse, status_code=status.HTTP_202_ACCEPTED
)(views.send_message)
sessions_router.post("/{session_id}/operations", response_model=OperationResponse)(views.record_operation)
sessions_router.get("/{session_id}/messages/{message_id}/context", response_model=list[SessionContextTurn])(
    views.message_context
)
sessions_router.post("/{session_id}/messages/{message_id}/feedback", response_model=SessionMessageRead)(
    views.set_message_feedback
)
sessions_router.post(
    "/{session_id}/messages/{message_id}/run", response_model=RerunResponse, status_code=status.HTTP_202_ACCEPTED
)(views.rerun_message)
