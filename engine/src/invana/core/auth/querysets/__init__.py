"""Queries behind identity (migration-plan §4.1).

Grows as `core/auth` converts; `services.py` and `tokens.py` still hold the rest.
"""

from invana.core.auth.querysets.user import UserQuerySet

__all__ = ["UserQuerySet"]
