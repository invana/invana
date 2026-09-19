"""Board rules, as classes. This is the Python API (migration-plan §6)."""

from invana.apps.boards.managers.board import BoardManager
from invana.apps.boards.managers.version import BoardVersionManager

__all__ = ["BoardManager", "BoardVersionManager"]
