"""The SQLAlchemy declarative base — and nothing else
(docs/for-developers/building-engine/code-shape.md §3.1).

Every table in the engine is declared against this ``Base``, in the package
that owns it. It lives in ``core`` because everything needs it and it needs
nothing: a declarative base imports no model, knows no table, and decides
nothing.

It used to live in ``modeller/models.py``, which is why fourteen packages
imported ``modeller`` and ``modeller`` imported them back for its migrations —
thirteen of the thirty-two cycles, from one misplaced class.
"""

from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base for all engine models."""
