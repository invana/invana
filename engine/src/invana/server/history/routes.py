"""Paths for a versioned record's history, under
``/api/v1/u/{username}/{graphSlug}/history``.

One route for every kind — ``skill`` · ``rule`` · ``plan`` · ``agent`` ·
``model`` — so Studio and the CLI read one shape. The change log itself is the
events list with ``?changes=true``.

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter

from invana.activity.schemas import ChangeCompare, RecordHistory
from invana.server.history import views

history_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/history", tags=["change-log"])

history_router.get("/{record_kind}/{record_id}", response_model=RecordHistory)(views.record_history)
history_router.get("/{record_kind}/{record_id}/compare", response_model=ChangeCompare)(views.compare_versions)
