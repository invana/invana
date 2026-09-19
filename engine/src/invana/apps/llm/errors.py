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


class QueryNotReadOnlyError(LLMError):
    """The model produced a query that would write — a **policy refusal**.

    It subclasses :class:`LLMError` so existing handlers keep catching it, but
    it is not a provider failure: the model answered, and Invana declined the
    answer. Told apart, the refusal reads as ``query_not_read_only`` with the
    query as evidence, instead of *the model could not produce an answer* and a
    suggestion to go and check the LLM provider — which is the one thing that is
    working.
    """

    def __init__(self, message: str, *, query: str) -> None:
        super().__init__(message)
        self.query = query
