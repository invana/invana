"""Every SQLAlchemy query against a ``skills`` row (migration-plan §4.1)."""

from invana.apps.skills.querysets.skill import SkillQuerySet

__all__ = ["SkillQuerySet"]
