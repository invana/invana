"""HTTP route tests for the authoring half of Govern.

These exist because the resolver behind `/lenses/validate` had 45 tests and the
**view** had none — so `ValidationRead` was built by reading `__dict__` off a
`slots=True` dataclass, which raises, and the route answered 500 on every call.
A test that stops at the manager cannot see a serialization fault.

Real Postgres, no mocks. The auth and membership dependencies are overridden —
they have their own tests — so what is under test here is routing, wiring and
the shape that reaches the wire.
"""

from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from invana.apps.govern.catalogue import Catalogue
from invana.apps.govern.managers import LensManager
from invana.apps.govern.models import LensKind
from invana.apps.govern.schemas import LensCreate, RuleIn
from invana.apps.graphs.models import Graph, GraphMember
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.server.app import create_app
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

pytestmark = pytest.mark.asyncio

lenses = LensManager()
BASE = "/api/v1/u/owner/atlas/govern"


@pytest_asyncio.fixture
async def client(db_engine):
    """The app on the suite's schema, with a Graph whose guardrail denies third parties.

    Committed rather than flushed: the routes open their own session, and a
    row that only exists inside an uncommitted transaction is a row they
    cannot see.
    """
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as s:
        user = User(
            email=f"{uuid.uuid4().hex[:8]}@example.com",
            username=f"u_{uuid.uuid4().hex[:8]}",
            password_hash="x",
            first_name="Owner",
        )
        s.add(user)
        await s.flush()
        graph = Graph(slug=f"g-{uuid.uuid4().hex[:6]}", name="Atlas", created_by_id=user.id, setup_state={})
        s.add(graph)
        await s.flush()
        member = GraphMember(graph_id=graph.id, user_id=user.id, can_edit_guardrails=True)
        s.add(member)
        await lenses.create(
            s,
            graph_id=graph.id,
            payload=LensCreate(
                name="Graph guardrails",
                kind=LensKind.guardrail,
                scope="graph",
                rules=[RuleIn(match="third_party/**", allow=False)],
            ),
            actor_id=user.id,
            # An empty catalogue is honest here: the guardrail denies a whole
            # layer, and a deny is never checked against what exists.
            catalogue=Catalogue(participants=()),
            may_edit_guardrails=True,
        )
        await s.commit()
        user_id, graph_id = user.id, graph.id

    async with factory() as s:
        user = await s.get(User, user_id)
        graph = await s.get(Graph, graph_id)
        # The real row, not `None`: four of these routes read
        # `can_edit_guardrails` off it, so a stub that answers nothing tests
        # the wiring of everything except the permission.
        member = await s.get(GraphMember, (graph_id, user_id))

    app = create_app()
    app.state.db_session_factory = factory

    async def _override_session():
        """Own the transaction boundary, exactly as the real dependency does.

        Without the commit a POST answers 201 with a body and leaves nothing
        behind, so any test that writes and then reads passes the write and
        404s the read.
        """
        async with factory() as sess:
            try:
                yield sess
            except Exception:
                await sess.rollback()
                raise
            else:
                await sess.commit()

    app.dependency_overrides[get_session] = _override_session
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[require_graph_member] = lambda: member
    app.dependency_overrides[resolve_graph_by_username_slug] = lambda: graph

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestAuthoringRoutes:
    async def test_a_clean_draft_validates_over_http(self, client):
        """The positive path, which is the one that was 500ing too."""
        resp = await client.post(f"{BASE}/lenses/validate", json={"rules": []})

        assert resp.status_code == 200
        body = resp.json()
        assert body == {"ok": True, "refusals": [], "warnings": []}

    async def test_a_widening_draft_is_refused_and_the_refusal_reaches_the_wire(self, client):
        """W3 · GV5 — and the refusal arrives as JSON, naming the guardrail's rule.

        The manager suite already asserts the refusal is *produced*. What this
        adds is that it survives serialization, which is the half that broke.
        """
        resp = await client.post(
            f"{BASE}/lenses/validate",
            json={"rules": [{"match": "third_party/api/clearbit.com/**", "allow": True}]},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is False
        refusal = body["refusals"][0]
        assert refusal["code"] == "widens_guardrail"
        assert refusal["recourse"] == "third_party/**"
        assert "Deny wins at any specificity" in refusal["message"]

    async def test_impact_names_what_a_guardrail_save_would_cost(self, client):
        """GR2 — read before the write, with a headline and one row per world."""
        resp = await client.post(
            f"{BASE}/lenses/impact",
            json={"rules": [{"match": "third_party/**", "allow": False}], "scope": "graph"},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert "headline" in body
        assert isinstance(body["worlds"], list)


class TestWhatTheDrawerReads:
    """The two facts the panels need that the manager suite never sees.

    Both are the same lesson as the 500: a field the resolver computes
    correctly and the view never puts on the wire is a field the screen cannot
    draw.
    """

    async def test_the_list_says_whether_this_member_may_edit_guardrails(self, client):
        """GR5 · GV22 — the rules read for everyone; the controls are a permission.

        It rides on the list because the drawer asks for the list exactly once,
        and two requests would let the bound and the right to edit it land at
        different moments.
        """
        resp = await client.get(f"{BASE}/lenses")

        assert resp.status_code == 200
        assert resp.json()["may_edit_guardrails"] is True

    async def test_a_lens_reads_back_with_its_cast_resolved_and_checked(self, client):
        """R4 — innermost wins, *then* the address is checked against the rules.

        The world is saved while its `decide` model is permitted, and the
        guardrail is tightened afterwards. That is the only way a stored world
        can carry a denied cast — a save is refused on the spot (WO3) — and it
        is exactly the case R4 exists to draw: the row comes back
        `allowed: false` naming the rule, rather than looking fine until a run
        refuses to open.
        """
        created = await client.post(
            f"{BASE}/lenses",
            json={"name": "Cast check", "cast": {"decide": "llm/anthropic-prod/claude-opus-5"}},
        )
        assert created.status_code == 201, created.text
        world_id = created.json()["id"]

        listed = await client.get(f"{BASE}/lenses", params={"kind": "guardrail"})
        guardrail_id = listed.json()["items"][0]["id"]
        tightened = await client.patch(
            f"{BASE}/lenses/{guardrail_id}",
            json={
                "rules": [
                    {"match": "third_party/**", "allow": False},
                    {"match": "llm/anthropic-prod/**", "allow": False},
                ]
            },
        )
        assert tightened.status_code == 200, tightened.text

        resp = await client.get(f"{BASE}/lenses/{world_id}")

        assert resp.status_code == 200
        rows = {row["role"]: row for row in resp.json()["cast_resolved"]}
        assert set(rows) == {"extract", "decide", "judge", "embed"}
        decide = rows["decide"]
        assert decide["address"] == "llm/anthropic-prod/claude-opus-5"
        assert decide["allowed"] is False
        assert decide["rule_matched"] == "llm/anthropic-prod/**"
        assert "does not widen" in decide["refusal"]
        # A role nobody casts is not a refusal until something asks for it.
        assert rows["judge"]["address"] is None
