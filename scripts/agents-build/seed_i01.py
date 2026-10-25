"""Seed the I01 boards' data into the dev database's admin/airways Graph.

The IAM boards need what no demo writes: two custom policies (``fare-team-quota``
with statements in four layers and every limit, ``route-reader``), a boundary
(``no-pii-out``), an assistant's draft (``agent-readers``), two people besides
admin, the groups ``fare-team`` · ``analysts`` · ``platform``, the service
accounts ``ci-bot`` and ``loader-bot`` with narrowed tokens, and attachments to
the airways agents. Everything goes through the IAM managers, so the rows are
the ones Studio would write.

Idempotent — a name that exists is left as it is. Run from the repo root:

    uv run --directory engine python ../scripts/agents-build/seed_i01.py
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select

# Every model the IAM tables reach by name, registered before the first query.
import invana.apps.annotations.models  # noqa: F401
import invana.apps.boards.models  # noqa: F401
import invana.apps.datasets.models  # noqa: F401
import invana.apps.flows.models  # noqa: F401
import invana.apps.llm_providers.models  # noqa: F401
import invana.apps.sessions.models  # noqa: F401
import invana.apps.skills.models  # noqa: F401
import invana.apps.standards.models  # noqa: F401
import invana.apps.work.models  # noqa: F401
from invana.apps.agents.models import Agent
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.iam.managers.attachments import AttachmentManager
from invana.apps.iam.managers.groups import GroupManager
from invana.apps.iam.managers.policies import PolicyManager
from invana.apps.iam.managers.service_accounts import ServiceAccountManager
from invana.apps.iam.managers.tokens import IamTokenManager
from invana.apps.iam.models import Group, Policy
from invana.apps.iam.schemas import (
    AttachRequest,
    GroupCreate,
    GroupMemberAdd,
    IamTokenCreate,
    Limits,
    PolicyCreate,
    ServiceAccountCreate,
    StatementIn,
)
from invana.core.auth.models import PersonalAccessToken, User
from invana.core.db import create_db_engine, create_session_factory

FARE_TEAM_QUOTA = PolicyCreate(
    name="fare-team-quota",
    description="Fares read, web read, limits for fare-team",
    statements=[
        StatementIn(actions=["graph.read.*"], resources=["graph/Fare/*", "graph/Route/*", "graph/Airport/*"]),
        StatementIn(
            actions=["graph.write.records"],
            resources=["graph/Fare/*"],
            conditions={"fields": {"only": ["price", "checked_at"]}},
        ),
        StatementIn(actions=["llm.call"], resources=["llm/anthropic/claude-haiku-5-5"]),
        StatementIn(actions=["llm.call"], resources=["llm/anthropic/claude-opus-5-5"], conditions={"depth": {"max": 0}}),
        StatementIn(actions=["web.read_url"], resources=["third_party/web/*.airline.com"]),
        StatementIn(actions=["mcp.figma.get_*"], resources=["third_party/mcp/figma/*"]),
        StatementIn(actions=["work.spawn_agent", "work.delegate"], resources=["agent/Fare Scout", "agent/Hub Checker"]),
    ],
    limits=Limits(
        tokens_month=6_000_000,
        tokens_run=400_000,
        live_agents=50,
        descendants=120,
        depth=2,
        worker_seconds_hour=12_000,
        pools=["k8s-prod", "egress"],
        may_ask_more=True,
    ),
)
ROUTE_READER = PolicyCreate(
    name="route-reader",
    description="Routes and Airports read",
    statements=[
        StatementIn(actions=["graph.read.*"], resources=["graph/Route/*", "graph/Airport/*"]),
        StatementIn(actions=["llm.call"], resources=["llm/*"]),
        StatementIn(actions=["work.create_task"], resources=["project/*"]),
    ],
)
NO_PII_OUT = PolicyCreate(
    name="no-pii-out",
    kind="boundary",
    description="nothing reads Person.email or sends it out",
    statements=[
        StatementIn(actions=["*"], resources=["graph/*"], conditions={"fields": {"except": ["email"]}}),
        StatementIn(actions=["*"], resources=["llm/*", "third_party/web/*", "third_party/mcp/*", "agent/*", "project/*"]),
    ],
)
DATASET_DRAFTS = PolicyCreate(
    name="dataset-drafts",
    description="Push draft dataset versions; a person publishes them",
    statements=[StatementIn(actions=["data.version.draft"], resources=["dataset/*"])],
)
AGENT_READERS = PolicyCreate(
    name="agent-readers",
    description="Every agent reads Routes, Airports and Fares, and nothing else in the Graph",
    statements=[
        StatementIn(actions=["graph.read.*"], resources=["graph/Route/*", "graph/Airport/*", "graph/Fare/*"]),
        StatementIn(actions=["llm.call"], resources=["llm/anthropic/*"]),
    ],
)


class Seeder:
    def __init__(self, db, graph: Graph, owner: User) -> None:
        self.db, self.graph, self.owner = db, graph, owner
        self.policies = PolicyManager()
        self.attachments = AttachmentManager()
        self.groups = GroupManager()

    async def policy(self, payload: PolicyCreate, *, save: bool = True, by: str = "person") -> Policy:
        found = await self.policies.qs.get_by_name(self.db, graph_id=self.graph.id, name=payload.name)
        if found is not None:
            return found
        await self.policies.create(self.db, graph_id=self.graph.id, payload=payload, actor_id=self.owner.id)
        if save:
            await self.policies.save(self.db, graph_id=self.graph.id, name=payload.name, why="seeded", actor_id=self.owner.id)
        policy = await self.policies.get_row(self.db, graph_id=self.graph.id, name=payload.name)
        policy.drafted_by = by
        return policy

    async def person(self, username: str, roles: list[str]) -> User:
        user = (await self.db.execute(select(User).where(User.username == username))).scalar_one_or_none()
        if user is None:
            user = User(
                email=f"{username}@airways.example.com",
                username=username,
                password_hash="!",
                first_name=username.title(),
            )
            self.db.add(user)
            await self.db.flush()
        member = (
            await self.db.execute(
                select(GraphMember).where(GraphMember.graph_id == self.graph.id, GraphMember.user_id == user.id)
            )
        ).scalar_one_or_none()
        if member is None:
            self.db.add(GraphMember(graph_id=self.graph.id, user_id=user.id, roles=roles))
            await self.db.flush()
        return user

    async def service_account(self, username: str, description: str) -> User:
        user = (await self.db.execute(select(User).where(User.username == username))).scalar_one_or_none()
        if user is None:
            await ServiceAccountManager().create(
                self.db,
                graph_id=self.graph.id,
                payload=ServiceAccountCreate(username=username, description=description),
                actor_id=self.owner.id,
            )
            user = (await self.db.execute(select(User).where(User.username == username))).scalar_one()
        return user

    async def group(self, name: str, description: str, members: list[tuple[str, str]]) -> None:
        exists = (
            await self.db.execute(select(Group).where(Group.graph_id == self.graph.id, Group.name == name))
        ).scalar_one_or_none()
        if exists is None:
            await self.groups.create(
                self.db,
                graph_id=self.graph.id,
                payload=GroupCreate(name=name, description=description),
                actor_id=self.owner.id,
            )
            for kind, member_id in members:
                await self.groups.add_member(
                    self.db,
                    graph_id=self.graph.id,
                    name=name,
                    payload=GroupMemberAdd(member_kind=kind, member_id=member_id),
                    actor_id=self.owner.id,
                )

    async def attach(self, policy: Policy, kind: str, holder_id: str) -> None:
        held = await self.policies.qs.attachment_for(
            self.db, policy_id=policy.id, holder_kind=kind, holder_id=holder_id
        )
        if held is None:
            await self.attachments.attach(
                self.db,
                graph_id=self.graph.id,
                policy=policy,
                request=AttachRequest(holder_kind=kind, holder_id=holder_id),
                actor_id=self.owner.id,
            )

    async def token(self, holder: User, name: str, statements: list[StatementIn], days: int | None) -> None:
        exists = (
            await self.db.execute(
                select(PersonalAccessToken).where(
                    PersonalAccessToken.user_id == holder.id, PersonalAccessToken.name == name
                )
            )
        ).scalar_one_or_none()
        if exists is None:
            await IamTokenManager().mint(
                self.db,
                graph=self.graph,
                payload=IamTokenCreate(name=name, holder_id=holder.id, statements=statements, expires_in_days=days),
                actor=self.owner,
                actor_is_iam_admin=True,
            )


async def seed(db) -> None:
    owner = (await db.execute(select(User).where(User.username == "admin"))).scalar_one()
    graph = (
        await db.execute(select(Graph).where(Graph.created_by_id == owner.id, Graph.slug == "airways"))
    ).scalar_one()
    s = Seeder(db, graph, owner)
    await s.policies.ensure_managed(db, graph_id=graph.id)

    quota = await s.policy(FARE_TEAM_QUOTA)
    reader = await s.policy(ROUTE_READER)
    await s.policy(NO_PII_OUT)
    readers_draft = await s.policy(AGENT_READERS, save=False, by="assistant")

    sam = await s.person("sam", ["builder", "iam-admin"])
    priya = await s.person("priya", ["viewer"])
    ci = await s.service_account("ci-bot", "Runs the nightly fare checks in CI")
    loader = await s.service_account("loader-bot", "Pushes draft datasets from the fares pipeline")

    agents = {
        a.name: a
        for a in (await db.execute(select(Agent).where(Agent.graph_id == graph.id, Agent.kind != "spawned")))
        .scalars()
        .all()
    }
    fare_agents = [agents[n] for n in ("Fare Scout", "Hub Checker", "Route Auditor", "Coordinator") if n in agents]
    await s.group(
        "fare-team",
        "Fares desk — people and the agents that check fares",
        [("person", sam.id), ("person", priya.id), *[("agent", a.id) for a in fare_agents]],
    )
    await s.group("analysts", "Read the Graph and ask", [("person", priya.id)])
    await s.group("platform", "Runs the Graph and its pipelines", [("person", sam.id)])

    fare_team = (await db.execute(select(Group).where(Group.graph_id == graph.id, Group.name == "fare-team"))).scalar_one()
    await s.attach(quota, "group", fare_team.id)
    for name in ("Route Auditor", "Hub Checker"):
        if name in agents:
            await s.attach(reader, "agent", agents[name].id)
            # The draft is meant for them: its impact is drawn against them before it is saved.
            await s.attach(readers_draft, "agent", agents[name].id)

    # A token is never wider than its holder, so loader-bot holds the drafts it pushes.
    drafts = await s.policy(DATASET_DRAFTS)
    await s.attach(drafts, "person", loader.id)
    await s.token(ci, "ci-bot", [StatementIn(actions=["graph.read.*"], resources=["graph/*"])], 90)
    await s.token(
        loader,
        "loader-bot",
        [StatementIn(actions=["data.version.draft"], resources=["dataset/*"])],
        30,
    )
    await db.commit()
    print(f"seeded IAM for admin/{graph.slug}")
    print("Coordinator id (iam.agent.effective):", agents["Coordinator"].id if "Coordinator" in agents else "—")


async def main() -> None:
    engine = await create_db_engine()
    factory = create_session_factory(engine)
    async with factory() as db:
        await seed(db)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
