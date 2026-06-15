"""Normalized LLM runtime error.

Every provider failure (network, timeout, bad credentials, unparseable output)
is re-raised as ``LLMError`` carrying a single user-facing message. Consumers
display ``message`` verbatim — the backend owns the toast copy (see
``rfc-028-backend-owned-action-messages``).
"""

from __future__ import annotations


class LLMError(Exception):
    """An LLM generation call failed. ``message`` is safe to show a user."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message
