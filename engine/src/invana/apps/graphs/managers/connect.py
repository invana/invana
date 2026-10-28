"""Connect a database — a new Graph, its connection and a drafted model, in one act.

`/graphs/new` is the connect form (connect-a-database.md): a Graph
with no database answers nothing, so connecting is how a Graph starts. The act
tests the connection first and makes nothing when the test fails; otherwise it
makes the Graph, saves the connection, and reads the database into a new
**authored** model whose draft holds every label, relationship type, index and
constraint the connector reports. Nothing is published — a schema nobody chose
is not a model (introspect-a-database.md).

The read uses its own connector, connected for the read and closed after it, so
the draft is ready when the call returns and does not wait on the pool, which
registers the saved connection (and refreshes the Graph's read-only mirror) once
the caller has committed.

```python
graph, connection, model_id, discovered = await ConnectManager().connect(
    session, owner=user, payload=payload, encryption_key=settings.encryption_key
)
await session.commit()
await pool.register(connection)
```
"""

from __future__ import annotations

import contextlib
import re
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.managers.graph import GraphManager, build_connector, test_connection_credentials
from invana.apps.graphs.models import Graph, GraphConnection
from invana.apps.graphs.querysets import GraphQuerySet
from invana.apps.graphs.schemas import (
    GRAPH_SLUG_MAX,
    GRAPH_SLUG_MIN,
    GraphConnect,
    GraphConnectionCreate,
    GraphCreate,
)
from invana.apps.modeller.introspector import Introspector
from invana.apps.modeller.store import ModelStore
from invana.core.auth.models import User
from invana.core.errors import ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event


def graph_name_for(payload: GraphConnect) -> str:
    """The name a connection gives its Graph: the one typed, the database, else the URI's host."""
    for candidate in (payload.name, payload.database, urlparse(payload.uri).hostname):
        if (candidate or "").strip():
            return candidate.strip()[:255]
    return "graph"


def slug_for(name: str) -> str:
    """``name`` made URL-safe, at least the slug's minimum length."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:GRAPH_SLUG_MAX].strip("-")
    return slug if len(slug) >= GRAPH_SLUG_MIN else f"graph-{slug}".strip("-")


class ConnectManager:
    """Stateless. The session is the first argument of every method."""

    graphs = GraphManager()
    graphs_qs = GraphQuerySet()
    store = ModelStore()

    async def free_slug(self, session: AsyncSession, *, owner_id: str, name: str) -> str:
        """The name's slug, suffixed ``-2``, ``-3`` … while the owner already has it."""
        base = slug_for(name)
        slug, n = base, 1
        while await self.graphs_qs.get_by_slug(session, owner_id=owner_id, slug=slug) is not None:
            n += 1
            suffix = f"-{n}"
            slug = f"{base[: GRAPH_SLUG_MAX - len(suffix)]}{suffix}"
        return slug

    async def connect(
        self, session: AsyncSession, *, owner: User, payload: GraphConnect, encryption_key: str
    ) -> tuple[Graph, GraphConnection, str, dict[str, int]]:
        """Test, then make the Graph, save its connection and draft a model from the database.

        Returns the Graph, its connection (for the caller to register once
        committed), the drafted model's id and what the read found. A failing
        test raises ``ValidationError`` with the connector's message and writes
        nothing.
        """
        tested = await test_connection_credentials(
            uri=payload.uri, connector_class=payload.connector_class, auth=payload.auth, database=payload.database
        )
        if not tested.get("ok"):
            raise ValidationError(
                {"error": "connection_failed", "message": tested.get("error") or "The database did not answer."}
            )

        name = graph_name_for(payload)
        slug = await self.free_slug(session, owner_id=owner.id, name=name)
        graph = await self.graphs.create_graph(session, owner=owner, payload=GraphCreate(name=name, slug=slug))
        connection_payload = GraphConnectionCreate.model_validate(payload.model_dump(exclude={"name"}))
        connection, _ = await self.graphs.put_graph_connection(
            session, graph=graph, payload=connection_payload, encryption_key=encryption_key, actor_id=owner.id
        )
        await emit_event(
            session,
            action=actions.CONNECTION_TEST,
            target_kind=actions.TARGET_CONNECTION,
            target_id=connection.id,
            graph_id=graph.id,
            actor_id=owner.id,
            details={"uri": payload.uri, "connector_class": payload.connector_class, **tested},
        )

        model = await self.store.create_graph_model(
            session, name=name, graph_id=graph.id, description=f"Drafted from {payload.uri}"
        )
        await emit_event(
            session,
            action=actions.MODEL_CREATE,
            target_kind=actions.TARGET_MODEL,
            target_id=model.id,
            graph_id=graph.id,
            actor_id=owner.id,
            details={"name": model.name, "via": "connect"},
        )
        connector = build_connector(
            connector_class=payload.connector_class, uri=payload.uri, auth=payload.auth, database=payload.database
        )
        try:
            await connector.connect()
            read = await Introspector(self.store).introspect(
                session, model_id=model.id, connector=connector, activate=False
            )
        finally:
            with contextlib.suppress(Exception):
                await connector.disconnect()
        return graph, connection, model.id, read["discovered"]
