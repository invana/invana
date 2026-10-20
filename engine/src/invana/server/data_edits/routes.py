"""Paths for a board's saved edits, under ``/api/v1/u/{username}/{graphSlug}``.

======================  ===================================================
POST ``/data-edits``    check a board's edits against the model and write them as a ``data-edit`` run
======================  ===================================================

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter

from invana.apps.modeller.schemas import DataEditResult
from invana.server.data_edits import views

data_edits_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}", tags=["data-edits"])

data_edits_router.post("/data-edits", response_model=DataEditResult)(views.save_data_edits)
