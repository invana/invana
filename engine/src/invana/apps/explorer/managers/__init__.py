"""Explorer rules, as classes. No models, so no querysets (migration-plan §7)."""

from invana.apps.explorer.managers.explore import ExploreManager

__all__ = ["ExploreManager"]
