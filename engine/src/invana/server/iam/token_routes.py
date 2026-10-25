"""Paths for IAM Tokens, under ``/api/v1/u/{username}/{graphSlug}/iam``.

=================================  ==============================================
GET ``/tokens``                    the tokens this Graph lists (``Page``)
POST ``/tokens``                   mint one bound to this Graph — the secret, once
DELETE ``/tokens/{token_id}``      revoke one, deleting its inline policy
=================================  ==============================================

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.apps.iam.schemas import IamTokenCreated, IamTokenPage
from invana.server.iam import token_views as views

tokens_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/iam", tags=["iam"])

tokens_router.get("/tokens", response_model=IamTokenPage)(views.list_tokens)
tokens_router.post("/tokens", response_model=IamTokenCreated, status_code=status.HTTP_201_CREATED)(views.create_token)
tokens_router.delete("/tokens/{token_id}", status_code=status.HTTP_204_NO_CONTENT)(views.revoke_token)
