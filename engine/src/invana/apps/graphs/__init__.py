"""The Graph domain — the container a person creates, and its one connection.

Per docs/for-developers/modules/identity-and-access/spec.md:

- ``Graph`` — the container entity (the unit of work).
- ``GraphConnection`` — 1:1 child of ``Graph``; the database binding. Live
  connector instances are held by ``ConnectionPool`` in ``pool.py``.
- ``GraphMember`` — graph-scoped membership (binary; roles removed in
  docs/for-developers/modules/identity-and-access/features/membership.md).

Whether a Graph is *ready* is not decided here — deriving that reads datasets,
models, providers and skills, so it lives in ``apps/setup`` (migration-plan §14.1).
"""

from invana.apps.graphs.models import (
    Graph,
    GraphConnection,
    GraphMember,
    GraphStatus,
)
from invana.apps.graphs.pool import ConnectionPool, GraphConnectionManager, GraphUnavailableError
from invana.apps.graphs.querysets import GraphConnectionQuerySet, GraphMemberQuerySet, GraphQuerySet

__all__ = [
    "ConnectionPool",
    "Graph",
    "GraphConnection",
    "GraphConnectionManager",  # pre-rename alias for ConnectionPool
    "GraphConnectionQuerySet",
    "GraphMember",
    "GraphMemberQuerySet",
    "GraphQuerySet",
    "GraphStatus",
    "GraphUnavailableError",
]
