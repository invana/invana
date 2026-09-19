"""The live databases the connector suite runs against
(docs/for-developers/modules/graph-connectors/features/the-connector-contract.md CC5).

*Integrations are conformance-tested against a live database, not mocked.* One
registry, so a test written once runs against every backend of its language and
a vendor difference surfaces as a named failure rather than as a gap nobody
looked at.

Bring them up with::

    docker compose --profile extra-dbs up -d

A backend nothing is listening on **skips**, naming the compose command — so a
checkout that started only Neo4j still runs, and a real regression is never
indistinguishable from a container that was not started.
"""

from __future__ import annotations

import os
import socket
from dataclasses import dataclass, field
from typing import Any

from invana_janusgraph import JanusGraphConnector
from invana_memgraph import MemgraphConnector
from invana_neo4j import Neo4jConnector

from invana.graph.connectors.base.connector import BaseConnector
from invana.graph.connectors.gremlin.connector import GremlinConnector
from invana.graph.types.constants import QueryLanguage


@dataclass(frozen=True)
class Backend:
    """One database this suite can talk to."""

    name: str
    language: QueryLanguage
    host: str
    port: int
    uri: str
    connector_class: type[BaseConnector]
    compose: str
    options: dict[str, Any] = field(default_factory=dict)

    def connector(self, **overrides: Any) -> BaseConnector:
        """A fresh connector for this backend.

        ``overrides`` let a test vary one setting — the named-database check
        needs a database that does not exist — without rebuilding the row.
        """
        return self.connector_class(self.uri, **{**self.options, **overrides})

    def is_up(self) -> bool:
        try:
            with socket.create_connection((self.host, self.port), timeout=2):
                return True
        except OSError:
            return False

    def __str__(self) -> str:  # pytest parameter id
        return self.name


def _env(key: str, default: str) -> str:
    return os.environ.get(key, default)


NEO4J = Backend(
    name="neo4j",
    language=QueryLanguage.CYPHER,
    host=_env("NEO4J_HOST", "localhost"),
    port=int(_env("NEO4J_PORT", "7687")),
    uri=_env("NEO4J_URI", "bolt://localhost:7687"),
    # The published integration class, not the core language connector — a
    # conformance suite that tested the base would never run the code a user
    # installs.
    connector_class=Neo4jConnector,
    options={
        "username": _env("NEO4J_USERNAME", "neo4j"),
        "password": _env("NEO4J_PASSWORD", "testpassword"),
        "database": _env("NEO4J_DATABASE", "neo4j"),
    },
    compose="docker compose up -d neo4j_5",
)

MEMGRAPH = Backend(
    name="memgraph",
    language=QueryLanguage.CYPHER,
    host=_env("MEMGRAPH_HOST", "localhost"),
    port=int(_env("MEMGRAPH_PORT", "17687")),
    uri=_env("MEMGRAPH_URI", "bolt://localhost:17687"),
    # Memgraph rides the Bolt driver and overrides almost nothing — the module
    # spec's own example of why a language connector is complete rather than
    # abstract (CN2). *Almost*: it has no ``elementId()``.
    connector_class=MemgraphConnector,
    options={
        "username": _env("MEMGRAPH_USERNAME", ""),
        "password": _env("MEMGRAPH_PASSWORD", ""),
        "database": _env("MEMGRAPH_DATABASE", "memgraph"),
    },
    compose="docker compose --profile memgraph up -d",
)

ARCADEDB = Backend(
    name="arcadedb",
    language=QueryLanguage.GREMLIN,
    host=_env("ARCADEDB_HOST", "localhost"),
    port=int(_env("ARCADEDB_GREMLIN_PORT", "18182")),
    uri=_env("ARCADEDB_GREMLIN_URI", "ws://localhost:18182/gremlin"),
    connector_class=GremlinConnector,
    options={
        "username": _env("ARCADEDB_USERNAME", "root"),
        "password": _env("ARCADEDB_PASSWORD", "testpassword"),
    },
    compose="docker compose --profile arcadedb up -d",
)

JANUSGRAPH = Backend(
    name="janusgraph",
    language=QueryLanguage.GREMLIN,
    host=_env("JANUSGRAPH_HOST", "localhost"),
    port=int(_env("JANUSGRAPH_PORT", "8182")),
    uri=_env("JANUSGRAPH_URI", "ws://localhost:8182/gremlin"),
    connector_class=JanusGraphConnector,
    compose="docker compose --profile janusgraph up -d",
)

BACKENDS = (NEO4J, MEMGRAPH, ARCADEDB, JANUSGRAPH)

CYPHER_BACKENDS = tuple(b for b in BACKENDS if b.language == QueryLanguage.CYPHER)
GREMLIN_BACKENDS = tuple(b for b in BACKENDS if b.language == QueryLanguage.GREMLIN)
