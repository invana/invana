"""Domain errors, raised by managers and translated at the edge.

A manager may not import ``fastapi`` (migration-plan §4.1), so it cannot raise
``HTTPException``. It raises one of these instead, and ``server/app.py`` maps
each to the status code the API has always returned. The CLI catches the same
types and prints them — which is the point: one rule, two front-ends.

The mapping is fixed, and changing it is an API change:

===================  ======
``NotFoundError``    404
``ConflictError``    409
``AuthenticationError``  401
``PermissionDeniedError``  403
``ValidationError``  422
===================  ======
"""

from __future__ import annotations


class InvanaError(Exception):
    """Base for every domain error the engine raises deliberately."""

    def __init__(self, detail: object) -> None:
        super().__init__(detail)
        # Usually a sentence. Some endpoints answer with a structured body
        # (``{"error": "dataset_not_found", ...}``) and that shape is part of
        # the API, so anything JSON-serialisable is allowed through unchanged.
        self.detail = detail


class NotFoundError(InvanaError):
    """The subject does not exist, or the caller may not see that it does."""


class ConflictError(InvanaError):
    """The write collides with something already stored — a unique name, a state machine."""


class PermissionDeniedError(InvanaError):
    """The caller is known but not allowed. Named in full — ``PermissionError``
    is a builtin, and shadowing it in a module every manager imports is a trap."""


class AuthenticationError(InvanaError):
    """The caller is not who they claim, or did not say. 401.

    Distinct from ``PermissionDeniedError``: that one knows who you are and
    still says no.
    """


class ValidationError(InvanaError):
    """The request is well-formed but the values are not usable."""
