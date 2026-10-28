"""Connect a database — a failing test makes nothing."""

import pytest
from sqlalchemy import func, select

from invana.apps.graphs.managers.connect import ConnectManager, slug_for
from invana.apps.graphs.models import Graph
from invana.apps.graphs.schemas import GraphConnect
from invana.core.errors import ValidationError

from .conftest import TEST_CONNECTOR_CLASS, TEST_ENCRYPTION_KEY


def test_slug_from_name():
    assert slug_for("Air Routes!") == "air-routes"


@pytest.mark.asyncio
async def test_connect_refuses_unreachable_database(session, user):
    payload = GraphConnect(
        uri="bolt://127.0.0.1:1",
        connector_class=TEST_CONNECTOR_CLASS,
        auth={"username": "neo4j", "password": "wrong"},
    )

    with pytest.raises(ValidationError):
        await ConnectManager().connect(session, owner=user, payload=payload, encryption_key=TEST_ENCRYPTION_KEY)

    graphs = await session.scalar(select(func.count()).select_from(Graph).where(Graph.created_by_id == user.id))
    assert graphs == 0
