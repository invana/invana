"""Every SQLAlchemy query against a standard row (migration-plan §4.1)."""

from invana.apps.standards.querysets.standard import StandardQuerySet, StandardVersionQuerySet

__all__ = ["StandardQuerySet", "StandardVersionQuerySet"]
