"""Seed the I02 board's data into the dev database's admin/airways Graph, then use it as Claude Code would.

The ``agents.connections`` board needs what no demo writes: two served agents and
both served functions on this Graph's MCP server, a dataset ``admin/eu-airports``,
a token ``cc-admin-laptop`` narrowed to checking and drafting that dataset, and
recent calls. The calls are real: the script speaks MCP to the live engine
(``INVANA_ENGINE_URL``, default ``http://localhost:8200``) with the token —
``initialize`` as ``claude-code``, ``validate_records`` with three records that
cannot be keyed, then ``push_draft_version`` — which is the phase's done-when,
end to end. A person then publishes the draft in Datasets.

The token's secret is shown once, so a re-run revokes ``cc-admin-laptop`` and
mints it again; the calls are made only while the Graph has none, unless
``--again`` is passed. Run from the repo root:

    uv run --directory engine python ../scripts/agents-build/seed_i02.py
"""

from __future__ import annotations

import asyncio
import os
import sys

import httpx
from sqlalchemy import select

# Every model the tables reach by name, registered before the first query.
import invana.apps.annotations.models  # noqa: F401
import invana.apps.boards.models  # noqa: F401
import invana.apps.flows.models  # noqa: F401
import invana.apps.llm_providers.models  # noqa: F401
import invana.apps.sessions.models  # noqa: F401
import invana.apps.skills.models  # noqa: F401
import invana.apps.standards.models  # noqa: F401
import invana.apps.work.models  # noqa: F401
from invana.apps.datasets.managers import DatasetManager
from invana.apps.datasets.models import Dataset
from invana.apps.datasets.schemas import AuthorStep, DatasetCreate, DatasetVersionCreate
from invana.apps.graphs.models import Graph
from invana.apps.iam.managers.tokens import IamTokenManager
from invana.apps.iam.schemas import IamTokenCreate, StatementIn
from invana.core.auth.models import PersonalAccessToken, User
from invana.core.db import create_db_engine, create_session_factory
from invana.runtime.managers.mcp_server import McpServerManager

ENGINE = os.environ.get("INVANA_ENGINE_URL", "http://localhost:8200")
TOKEN = "cc-admin-laptop"
DATASET = "admin/eu-airports"
#: The agents served, the first two found in this order.
SERVE_AGENTS = ("Fare Lead", "Analyst assistant", "Coordinator", "Assistant", "Route Auditor")
AUTHORS = [AuthorStep(role="original", kind="organisation", name="Eurocontrol")]
V1 = [
    {"id": "LHR", "name": "London Heathrow", "country": "GB"},
    {"id": "CDG", "name": "Paris Charles de Gaulle", "country": "FR"},
    {"id": "FRA", "name": "Frankfurt", "country": "DE"},
    {"id": "AMS", "name": "Amsterdam Schiphol", "country": "NL"},
]
V2 = [*V1, {"id": "MAD", "name": "Madrid Barajas", "country": "ES"}, {"id": "FCO", "name": "Rome Fiumicino", "country": "IT"}]
BAD = [{"name": "Unnamed strip", "country": "IE"}, {"name": "Old field", "country": "PT"}, {"country": "GR"}]


async def seed(db) -> str:
    owner = (await db.execute(select(User).where(User.username == "admin"))).scalar_one()
    graph = (
        await db.execute(select(Graph).where(Graph.created_by_id == owner.id, Graph.slug == "airways"))
    ).scalar_one()
    mcp = McpServerManager()
    candidates = await mcp.candidates(db, graph=graph)
    by_name = {c.name: c for c in candidates if c.kind == "agent"}
    agents = [by_name[n] for n in SERVE_AGENTS if n in by_name][:2]
    for c in [*agents, *(c for c in candidates if c.kind == "function")]:
        await mcp.set_served(db, graph=graph, kind=c.kind, ref=c.ref, served=True, actor=owner)

    publisher, name = DATASET.split("/")
    datasets = DatasetManager()
    found = (
        await db.execute(select(Dataset).where(Dataset.publisher == publisher, Dataset.name == name))
    ).scalar_one_or_none()
    if found is None:
        ds = await datasets.create(
            db, payload=DatasetCreate(publisher=publisher, name=name, origin="official"), actor=owner
        )
        await datasets.publish_version(
            db,
            dataset=ds,
            payload=DatasetVersionCreate(licence="CC-BY-4.0", author_chain=AUTHORS, records=V1),
            actor=owner,
        )

    tokens = IamTokenManager()
    old = (
        await db.execute(
            select(PersonalAccessToken).where(PersonalAccessToken.user_id == owner.id, PersonalAccessToken.name == TOKEN)
        )
    ).scalar_one_or_none()
    if old is not None:
        await tokens.revoke(db, graph=graph, token_id=old.id, actor=owner, actor_is_iam_admin=True)
    minted = await tokens.mint(
        db,
        graph=graph,
        payload=IamTokenCreate(
            name=TOKEN,
            statements=[
                StatementIn(actions=["data.version.check", "data.version.draft"], resources=[f"dataset/{DATASET}"])
            ],
            expires_in_days=30,
        ),
        actor=owner,
        actor_is_iam_admin=True,
    )
    _, total = await mcp.calls(db, graph=graph, limit=1)
    await db.commit()
    print(f"served on admin/{graph.slug}: {', '.join(c.tool for c in agents)} + both functions")
    return minted.secret if (total == 0 or "--again" in sys.argv) else ""


def call(client: httpx.Client, headers: dict, n: int, method: str, params: dict) -> dict:
    reply = client.post("/api/v1/u/admin/airways/mcp", json={"jsonrpc": "2.0", "id": n, "method": method, "params": params}, headers=headers)
    reply.raise_for_status()
    return reply.json()


def use_it(secret: str) -> None:
    """Claude Code's session: initialize, check records, push a draft."""
    token = {"Authorization": f"Bearer {secret}"}
    with httpx.Client(base_url=ENGINE, timeout=120) as client:
        init = client.post(
            "/api/v1/u/admin/airways/mcp",
            json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"clientInfo": {"name": "Claude Code"}}},
            headers=token,
        )
        init.raise_for_status()
        headers = {**token, "Mcp-Session-Id": init.headers["Mcp-Session-Id"]}
        tools = call(client, headers, 2, "tools/list", {})["result"]["tools"]
        print("tools:", ", ".join(t["name"] for t in tools))
        checked = call(client, headers, 3, "tools/call", {"name": "validate_records", "arguments": {"dataset": DATASET, "records": [*V2, *BAD]}})
        print("validate_records:", checked["result"]["content"][0]["text"].splitlines()[0])
        pushed = call(
            client,
            headers,
            4,
            "tools/call",
            {
                "name": "push_draft_version",
                "arguments": {
                    "dataset": DATASET,
                    "records": V2,
                    "licence": "CC-BY-4.0",
                    "author_chain": [a.model_dump(mode="json") for a in AUTHORS],
                    "why": "Madrid and Rome added",
                },
            },
        )
        print("push_draft_version:", pushed["result"]["content"][0]["text"].splitlines()[0])
        other = call(client, headers, 5, "tools/call", {"name": "push_draft_version", "arguments": {"dataset": "admin/airports", "records": V2, "licence": "CC-BY-4.0"}})
        print("another dataset:", other["result"]["content"][0]["text"])


async def main() -> None:
    engine = await create_db_engine()
    factory = create_session_factory(engine)
    async with factory() as db:
        secret = await seed(db)
    await engine.dispose()
    if secret:
        use_it(secret)
    else:
        print("calls already recorded — pass --again to call again")


if __name__ == "__main__":
    asyncio.run(main())
