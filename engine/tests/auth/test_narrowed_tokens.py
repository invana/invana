"""Narrowed tokens: an IAM token limited by an inline policy, end to end over HTTP
(docs/for-developers/modules/identity-and-access/features/tokens.md ·
docs/for-developers/modules/bring-data-in/features/datasets.md, draft versions).

A Graph owner, signed in, mints a token narrowed to pushing drafts of one
dataset. With it a draft lands and is not current; a Graph read, publishing,
and a draft to another dataset are each ``403 token_narrowed``. A member whose
roles do not allow a narrowing is refused it at mint. The owner, signed in,
publishes the draft and it becomes current.

The app database only — no graph database is touched.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Every table the FKs touch, so `create_all` builds them.
from invana.apps.agents.models import Agent  # noqa: F401
from invana.apps.boards.models import Board  # noqa: F401
from invana.apps.datasets.managers import DatasetManager
from invana.apps.datasets.models import Dataset  # noqa: F401
from invana.apps.datasets.schemas import AuthorStep, DatasetCreate, DatasetVersionCreate
from invana.apps.flows.models import Flow  # noqa: F401
from invana.apps.govern.models import Lens  # noqa: F401
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.iam.managed import MANAGED
from invana.apps.iam.models import Policy
from invana.apps.llm_providers.models import LLMProvider  # noqa: F401
from invana.apps.modeller.models import GraphModel  # noqa: F401
from invana.apps.sessions.models import Session  # noqa: F401
from invana.apps.skills.models import Skill  # noqa: F401
from invana.apps.work.models import Project  # noqa: F401
from invana.core.auth.jwt import encode_access_token
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.ledger.models import LedgerRow  # noqa: F401
from invana.runtime.models import TaskRun  # noqa: F401
from invana.server.app import create_app
from invana.server.iam.token_routes import tokens_router

pytestmark = pytest.mark.asyncio

AUTHORS = [AuthorStep(role="original", kind="organisation", name="Airport authority")]
V1 = [{"id": "LHR", "name": "Heathrow"}, {"id": "JFK", "name": "Kennedy"}]
V2 = [*V1, {"id": "SFO", "name": "San Francisco"}]
DRAFT_BODY = {
    "licence": "CC-BY-4.0",
    "author_chain": [a.model_dump(mode="json") for a in AUTHORS],
    "records": V2,
}
NARROW = [{"actions": ["data.version.draft"], "resources": ["dataset/ravi/airports"]}]


@pytest_asyncio.fixture
async def world(session):
    """An owner and a viewer of one Graph, its managed policies, and two datasets the owner made."""
    owner = User(email="ravi@example.com", username="ravi", password_hash="x", first_name="Ravi")
    viewer = User(email="sam@example.com", username="sam", password_hash="x", first_name="Sam")
    session.add_all([owner, viewer])
    await session.flush()
    graph = Graph(slug="atlas", name="Atlas", created_by_id=owner.id, setup_state={})
    session.add(graph)
    await session.flush()
    session.add_all(
        [
            GraphMember(graph_id=graph.id, user_id=owner.id, roles=["owner"]),
            GraphMember(graph_id=graph.id, user_id=viewer.id, roles=["viewer"]),
            *(
                Policy(
                    graph_id=graph.id,
                    name=m.name,
                    kind="managed",
                    status="saved",
                    version=1,
                    statements=list(m.statements),
                )
                for m in MANAGED
            ),
        ]
    )
    datasets = DatasetManager()
    for name in ("airports", "airlines"):
        ds = await datasets.create(
            session, payload=DatasetCreate(publisher="ravi", name=name, origin="official"), actor=owner
        )
        await datasets.publish_version(
            session,
            dataset=ds,
            payload=DatasetVersionCreate(licence="CC-BY-4.0", author_chain=AUTHORS, records=V1),
            actor=owner,
        )
    await session.commit()
    return owner, viewer


@pytest_asyncio.fixture
async def client(session_factory):
    app = create_app()
    if not any(getattr(r, "path", "").endswith("/iam/tokens") for r in app.routes):
        app.include_router(tokens_router)

    async def _override_session():
        async with session_factory() as sess:
            try:
                yield sess
                await sess.commit()
            except Exception:
                await sess.rollback()
                raise

    app.dependency_overrides[get_session] = _override_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


def _signed_in(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {encode_access_token(user_id=user.id, is_superuser=False)}"}


async def test_a_narrowed_token_pushes_a_draft_and_nothing_else(client, world) -> None:
    owner, _ = world
    minted = await client.post(
        "/api/v1/u/ravi/atlas/iam/tokens",
        json={"name": "ci drafts", "statements": NARROW, "expires_in_days": 30},
        headers=_signed_in(owner),
    )
    assert minted.status_code == 201, minted.text
    body = minted.json()
    assert body["graph_bound"] is True and body["policy"] == "token-ci-drafts"
    assert body["narrowed_to"] == "inline · data.version.draft"
    token = {"Authorization": f"Bearer {body['secret']}"}

    pushed = await client.post("/api/v1/datasets/ravi/airports/versions/drafts", json=DRAFT_BODY, headers=token)
    assert pushed.status_code == 201, pushed.text
    assert pushed.json()["state"] == "draft" and pushed.json()["version"] == 2
    detail = (await client.get("/api/v1/datasets/ravi/airports", headers=_signed_in(owner))).json()
    assert detail["current_version"] == 1

    for method, path, payload in (
        ("GET", "/api/v1/u/ravi/atlas/iam/tokens", None),
        ("POST", "/api/v1/datasets/ravi/airports/versions/2/publish", None),
        ("POST", "/api/v1/datasets/ravi/airlines/versions/drafts", DRAFT_BODY),
    ):
        refused = await client.request(method, path, json=payload, headers=token)
        assert refused.status_code == 403, (path, refused.text)
        assert refused.json()["detail"]["error"] == "token_narrowed"
        assert refused.json()["detail"]["policy"] == "token-ci-drafts"

    listed = (await client.get("/api/v1/u/ravi/atlas/iam/tokens", headers=_signed_in(owner))).json()
    assert [t["name"] for t in listed["items"]] == ["ci drafts"]

    published = await client.post("/api/v1/datasets/ravi/airports/versions/2/publish", headers=_signed_in(owner))
    assert published.status_code == 200, published.text
    assert published.json()["state"] == "published"
    detail = (await client.get("/api/v1/datasets/ravi/airports", headers=_signed_in(owner))).json()
    assert detail["current_version"] == 2


async def test_a_narrowing_wider_than_the_holder_is_refused(client, world) -> None:
    _, viewer = world
    refused = await client.post(
        "/api/v1/u/ravi/atlas/iam/tokens",
        json={"name": "too wide", "statements": NARROW},
        headers=_signed_in(viewer),
    )
    assert refused.status_code == 422, refused.text
    assert "never wider than its holder" in refused.text
    assert "data.version.draft on dataset/ravi/airports" in refused.text
