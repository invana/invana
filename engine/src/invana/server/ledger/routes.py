"""Paths for the ledger — ``/api/v1/u/{username}/{graphSlug}/ledger``.

The fixed paths sit above ``/{row_id}`` so a word is never read as a row id.
Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter

from invana.core.ledger.schemas import (
    LedgerActorRead,
    LedgerExportRead,
    LedgerIntegrity,
    LedgerPage,
    LedgerRecordRead,
    LedgerRefusalsRead,
    LedgerRowDetail,
    LedgerStats,
)
from invana.core.lists import Page
from invana.server.ledger import views

ledger_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/ledger", tags=["ledger"])

ledger_router.get("", response_model=LedgerPage)(views.list_rows)
ledger_router.get("/stats", response_model=LedgerStats)(views.get_stats)
ledger_router.get("/actor", response_model=LedgerActorRead)(views.get_actor)
ledger_router.get("/record", response_model=LedgerRecordRead)(views.get_record)
ledger_router.get("/refusals", response_model=LedgerRefusalsRead)(views.get_refusals)
ledger_router.get("/export", response_class=views.StreamingResponse)(views.export_rows)
ledger_router.get("/exports", response_model=Page[LedgerExportRead])(views.list_exports)
ledger_router.get("/integrity", response_model=LedgerIntegrity)(views.get_integrity)
ledger_router.get("/{row_id}", response_model=LedgerRowDetail)(views.get_row)

__all__ = ["ledger_router"]
