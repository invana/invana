"""graphs package — re-exports for convenient imports.

The package houses the Graph domain per RFC-017:

- ``Graph`` — the container entity (unit of work).
- ``GraphConnection`` — 1:1 child of ``Graph``; the DB binding (renamed from
  the previous ``Graph`` model). Live connector instances are managed by
  ``GraphConnectionManager``.
- ``GraphMember`` — graph-scoped membership (binary; roles removed in RFC-023).
"""

from invana.graphs.manager import GraphConnectionManager, GraphUnavailableError
from invana.graphs.models import (
    Graph,
    GraphConnection,
    GraphMember,
    GraphStatus,
)
from invana.graphs.store import GraphConnectionStore, GraphModelStore

__all__ = [
    "Graph",
    "GraphConnection",
    "GraphConnectionManager",
    "GraphConnectionStore",
    "GraphMember",
    "GraphModelStore",  # back-compat alias
    "GraphStatus",
    "GraphUnavailableError",
]
