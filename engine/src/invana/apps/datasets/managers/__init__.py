"""The rules for datasets, as classes — the Python API (migration-plan §4)."""

from invana.apps.datasets.managers.dataset import DatasetManager, parse_ref

__all__ = ["DatasetManager", "parse_ref"]
