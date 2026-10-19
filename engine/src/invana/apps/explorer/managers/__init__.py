"""Explorer rules, as classes. No models, so no querysets (migration-plan §7)."""

from invana.apps.explorer.managers.explore import ExploreManager, type_total

__all__ = ["ExploreManager", "type_total"]
