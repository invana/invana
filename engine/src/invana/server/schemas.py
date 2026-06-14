"""Shared response envelopes for the HTTP server (RFC-028).

``ActionResponse`` is the standard body for a *mutating* endpoint that should
surface a toast: it carries a backend-owned ``message`` plus the affected
``data`` (the created/updated resource, or ``None`` for a delete / pure action).

The studio's axios layer toasts ``message`` centrally and unwraps ``data`` for
callers, so call sites never hardcode their own success string. Endpoints that
should stay silent (telemetry export, token refresh, …) simply return their
plain body and skip this envelope.
"""

from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel

DataT = TypeVar("DataT")


class ActionResponse(BaseModel, Generic[DataT]):
    """Standard envelope for a mutating endpoint (RFC-028).

    ``data`` is always serialised (null for deletes) so the frontend can use its
    presence — alongside a string ``message`` — to tell the envelope apart from a
    bare resource body.
    """

    message: str
    data: DataT | None = None


def action(message: str, data: DataT | None = None) -> ActionResponse[DataT]:
    """Build an :class:`ActionResponse` for a mutating endpoint."""
    return ActionResponse(message=message, data=data)
