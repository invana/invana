"""Archive, restore and delete a model, and the DDL a publish would project.

From the-model-page.md: a published model is archived, never deleted; archiving is
refused while an active stitch binds it, naming the stitch; an archived model
leaves the union (MP7). The Publish confirm lists what the projection will create
without writing it (MP8).
"""

import uuid

import pytest
import pytest_asyncio

from invana.apps.graphs.models import Graph
from invana.apps.modeller.links import commit_staged, declare, derive_global_model
from invana.apps.modeller.managers import ModelLifecycleManager
from invana.apps.modeller.projector import plan_projection
from invana.apps.modeller.versioner import Versioner
from invana.core.auth.models import User
from invana.core.errors import ConflictError

lifecycle = ModelLifecycleManager()


@pytest_asyncio.fixture
async def graph_id(session):
    user = User(
        username=f"owner{uuid.uuid4().hex[:6]}",
        email=f"{uuid.uuid4().hex[:8]}@invana.test",
        password_hash="x",
        first_name="Owner",
    )
    session.add(user)
    await session.flush()
    graph = Graph(name="airways", slug=f"airways-{uuid.uuid4().hex[:6]}", created_by_id=user.id)
    session.add(graph)
    await session.flush()
    return graph.id


async def _published(session, store, *, name, graph_id, types):
    model = await store.create_graph_model(session, name=name, graph_id=graph_id)
    draft = await store.create_version(session, model_id=model.id)
    for type_name in types:
        await store.create_node_type(session, version_id=draft.id, name=type_name)
    await session.flush()
    active = await Versioner(store).activate(session, version_id=draft.id)
    await session.flush()
    return model, await store.get_version(session, active.id)


@pytest.mark.asyncio
class TestArchiveAndDelete:
    async def test_a_never_published_model_can_be_deleted(self, session, store, graph_id):
        model = await store.create_graph_model(session, name="Scratch", graph_id=graph_id)
        await store.create_version(session, model_id=model.id)
        await session.flush()

        await lifecycle.ensure_deletable(session, model)

    async def test_a_published_model_is_archived_not_deleted(self, session, store, graph_id):
        model, _ = await _published(session, store, name="AirRoutes", graph_id=graph_id, types=["airport"])

        with pytest.raises(ConflictError) as exc:
            await lifecycle.ensure_deletable(session, model)
        assert exc.value.detail["error"] == "delete_has_published_version"

        await lifecycle.archive(session, model)
        union = await derive_global_model(session, store, graph_id=graph_id)
        assert model.status == "archived"
        assert union.model_count == 0

        await lifecycle.restore(session, model)
        assert model.status == "active"

    async def test_archive_is_refused_naming_each_active_stitch(self, session, store, graph_id):
        routes, air = await _published(session, store, name="AirRoutes2", graph_id=graph_id, types=["airport"])
        _, news = await _published(session, store, name="NewsArticles", graph_id=graph_id, types=["place"])
        await declare(
            session,
            store,
            graph_id=graph_id,
            kind="anchor",
            source_version_id=news.id,
            source_type="place",
            target_version_id=air.id,
            target_type="airport",
            source_property="iata",
            target_property="code",
        )
        await commit_staged(session, graph_id)

        with pytest.raises(ConflictError) as exc:
            await lifecycle.archive(session, routes)
        assert exc.value.detail["error"] == "archive_has_active_stitches"
        assert [(s["source"], s["target"]) for s in exc.value.detail["stitches"]] == [
            ("NewsArticles.place", "AirRoutes2.airport")
        ]
        assert routes.status != "archived"


@pytest.mark.asyncio
class TestProjectionPlan:
    async def test_the_plan_lists_only_what_the_draft_adds(self, session, store, graph_id):
        model, active = await _published(session, store, name="AirRoutes3", graph_id=graph_id, types=["airport"])
        draft = await store.create_version(session, model_id=model.id, based_on=active.version)
        await store.create_index(
            session,
            version_id=draft.id,
            name="airport_city",
            target_kind="node_type",
            target_label="airport",
            properties=["city"],
            index_type="range",
        )
        await session.flush()

        plan = await plan_projection(await store.get_version(session, draft.id), connector=None, baseline=active)

        assert plan["against"] == "active_version"
        assert [op["statement"] for op in plan["operations"]] == ["CREATE RANGE INDEX airport_city ON airport(city)"]

    async def test_nothing_staged_plans_nothing(self, session, store, graph_id):
        _, active = await _published(session, store, name="AirRoutes4", graph_id=graph_id, types=["airport"])

        plan = await plan_projection(active, connector=None, baseline=active)

        assert plan["operations"] == []
