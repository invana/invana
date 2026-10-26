"""Secrets of the worker gateway — join tokens and worker credentials.

Both are opaque and prefixed so a secret scanner recognises them; only the
sha256 is stored. The auth edge (``core/auth/deps.py``) refuses the join prefix
on every route but ``POST /api/v1/workers/join``.
"""

from __future__ import annotations

from invana.core.auth.tokens import generate_token, hash_token

JOIN_PREFIX = "invana_join_"
WORKER_PREFIX = "invana_wkr_"

__all__ = ["JOIN_PREFIX", "WORKER_PREFIX", "hash_token", "new_join_token", "new_worker_credential"]


def new_join_token() -> str:
    return JOIN_PREFIX + generate_token()


def new_worker_credential() -> str:
    return WORKER_PREFIX + generate_token()
