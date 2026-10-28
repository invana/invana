"""Paths for requests — ``/api/v1/u/{username}/{graphSlug}/requests``.

======================================  ======================================
GET  ``""``                             the inbox · ``status`` · ``kind``
POST ``""``                             *Ask for a change*
GET  ``/{id}``                          one request
POST ``/{id}/resolve``                  decline · allow in a world · model it
======================================  ======================================

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.apps.govern.schemas import RequestPage, RequestRead
from invana.server.requests import views

requests_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/requests", tags=["govern"])

requests_router.get("", response_model=RequestPage)(views.list_requests)
requests_router.post("", response_model=RequestRead, status_code=status.HTTP_201_CREATED)(views.create_request)
requests_router.get("/{request_id}", response_model=RequestRead)(views.get_request)
requests_router.post("/{request_id}/resolve", response_model=RequestRead)(views.resolve_request)

__all__ = ["requests_router"]
