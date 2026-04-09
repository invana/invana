"""Shared utility helpers for the Invana engine."""

from __future__ import annotations

import importlib


def import_class_from_dotted_path(dotted: str) -> type:
    """Import and return a class from a dotted module path.

    Examples::

        import_class_from_dotted_path(
            "invana.graph.connectors.cypher.connector.OpenCypherConnector"
        )
        import_class_from_dotted_path("invana_neo4j.connector.Neo4jConnector")

    Args:
        dotted: Full dotted path to a class, e.g.
            ``"invana.graph.connectors.cypher.connector.OpenCypherConnector"``.

    Raises:
        ValueError: If the string contains no dot (cannot split module from class).
        ImportError: If the module portion cannot be imported.
        AttributeError: If the class name does not exist in the module.
    """
    if "." not in dotted:
        raise ValueError(f"Expected a dotted path like 'mypackage.module.ClassName', got: {dotted!r}")
    module_path, cls_name = dotted.rsplit(".", 1)
    try:
        module = importlib.import_module(module_path)
    except ImportError as exc:
        raise ImportError(f"Cannot import module {module_path!r}. Is the package installed?\n  {exc}") from exc
    try:
        return getattr(module, cls_name)
    except AttributeError as exc:
        raise AttributeError(f"Module {module_path!r} has no attribute {cls_name!r}.") from exc
