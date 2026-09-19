"""A bundle's stitches, declared against a Graph (stitch-models.md ST39-ST43).

The rules under test: a manifest declares staged rows, applying it again declares
nothing twice (ST41), a model with only a draft is skipped saying so (ST40/ST8), and a
relationship whose endpoints are rows binds the model whose records ship them (ST42).
"""

import json
import uuid

import pytest
import pytest_asyncio

from invana.apps.graphs.models import Graph
from invana.apps.modeller.links import list_links
from invana.apps.modeller.versioner import Versioner
from invana.core.auth.models import User
from invana.runtime.catalogue.stitching import apply_bundle


@pytest_asyncio.fixture
async def graph_id(session):
    """A Graph and its owner — both foreign keys are real rows."""
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


async def _model(session, store, *, graph_id, name, types, package_id, publish=True):
    model = await store.create_graph_model(session, name=name, graph_id=graph_id)
    model.package_id = package_id
    draft = await store.create_version(session, model_id=model.id)
    for type_name in types:
        await store.create_node_type(session, version_id=draft.id, name=type_name)
    await session.flush()
    if publish:
        await Versioner(store).activate(session, version_id=draft.id)
        await session.flush()
    return model


def _bundle(root, rules, datasets):
    """`datasets` is {folder: (package_id, model name)}."""
    for folder, (package_id, name) in datasets.items():
        (root / folder).mkdir(parents=True, exist_ok=True)
        (root / folder / "graph-model.json").write_text(
            json.dumps({"package_id": package_id, "name": name, "model": {}}), encoding="utf-8"
        )
    (root / "stitches.json").write_text(
        json.dumps({"name": "airways", "datasets": list(datasets), "stitches": rules}), encoding="utf-8"
    )
    return root


ANCHOR = {
    "id": "A1",
    "kind": "anchor",
    "source": "news-articles:Country.iso_code",
    "target": "air-routes:country.code",
}
DATASETS = {"news-articles": ("pkg-news", "NewsArticles"), "air-routes": ("pkg-routes", "AirRoutes")}


async def _two_models(session, store, graph_id, *, publish_news=True):
    news = await _model(
        session,
        store,
        graph_id=graph_id,
        name="NewsArticles",
        types=["Country", "Tweet"],
        package_id="pkg-news",
        publish=publish_news,
    )
    routes = await _model(
        session, store, graph_id=graph_id, name="AirRoutes", types=["country"], package_id="pkg-routes"
    )
    return news, routes


@pytest.mark.asyncio
class TestApplyingABundle:
    async def test_a_rule_declares_staged(self, session, store, graph_id, tmp_path):
        await _two_models(session, store, graph_id)
        root = _bundle(tmp_path, [ANCHOR], DATASETS)

        run = await apply_bundle(session, store, graph_id=graph_id, root=root)

        assert (run.declared, run.already, run.skipped) == (1, 0, 0)
        links = await list_links(session, graph_id)
        assert [(link.kind, link.source_type, link.target_type, link.status) for link in links] == [
            ("anchor", "Country", "country", "staged")
        ]
        assert links[0].source_property == "iso_code"

    async def test_applying_twice_declares_nothing_twice(self, session, store, graph_id, tmp_path):
        await _two_models(session, store, graph_id)
        root = _bundle(tmp_path, [ANCHOR], DATASETS)

        await apply_bundle(session, store, graph_id=graph_id, root=root)
        again = await apply_bundle(session, store, graph_id=graph_id, root=root)

        assert (again.declared, again.already) == (0, 1)
        assert len(await list_links(session, graph_id)) == 1

    async def test_declaring_never_commits(self, session, store, graph_id, tmp_path):
        """Committing writes edges (ST44), so it is its own action and opens a connection."""
        await _two_models(session, store, graph_id)
        root = _bundle(tmp_path, [ANCHOR], DATASETS)

        await apply_bundle(session, store, graph_id=graph_id, root=root)

        assert [link.status for link in await list_links(session, graph_id)] == ["staged"]

    async def test_a_rows_sourced_rule_binds_the_source_model(self, session, store, graph_id, tmp_path):
        """ST42 — the rows ship with the *source's* records, and nothing was imported first.

        The model is resolved from the folder's own `graph-model.json` (LD23);
        there is no row anywhere saying what `news-articles` means.
        """
        news, _ = await _two_models(session, store, graph_id)
        rule = {
            "id": "R9",
            "kind": "relationship",
            "edge_type": "ABOUT",
            "rows": "ABOUT.json",
            "source": "news-articles:Tweet.tweet_id",
            "target": "air-routes:country.code",
        }
        root = _bundle(tmp_path, [rule], DATASETS)

        run = await apply_bundle(session, store, graph_id=graph_id, root=root)

        assert run.declared == 1
        link = (await list_links(session, graph_id))[0]
        # The source ships the file — binding the target would read the rows
        # out of the wrong folder and resolve every endpoint backwards.
        assert link.source_model_id == news.id
        # Keys or a source model, never both (ST27).
        assert (link.source_property, link.target_property) == (None, None)


@pytest.mark.asyncio
class TestWhatItRefusesToGuess:
    async def test_a_model_with_only_a_draft_is_skipped(self, session, store, graph_id, tmp_path):
        await _two_models(session, store, graph_id, publish_news=False)
        root = _bundle(tmp_path, [ANCHOR], DATASETS)

        run = await apply_bundle(session, store, graph_id=graph_id, root=root)

        assert run.skipped == 1
        assert not run.passed
        assert "no published version" in run.outcomes[0].detail
        assert await list_links(session, graph_id) == []

    async def test_a_rows_sourced_rule_whose_model_is_not_here_is_skipped(self, session, store, graph_id, tmp_path):
        """The folder declares a model this Graph does not have, so there is nothing to bind."""
        await _two_models(session, store, graph_id)
        datasets = {**DATASETS, "twitter": ("pkg-twitter", "Twitter")}
        rule = {
            "id": "R9",
            "kind": "relationship",
            "edge_type": "ABOUT",
            "rows": "ABOUT.json",
            "source": "twitter:Tweet.tweet_id",
            "target": "air-routes:country.code",
        }
        root = _bundle(tmp_path, [rule], datasets)

        run = await apply_bundle(session, store, graph_id=graph_id, root=root)

        assert run.skipped == 1
        assert "no model 'Twitter' in this Graph" in run.outcomes[0].detail

    async def test_a_type_the_version_does_not_carry_is_skipped(self, session, store, graph_id, tmp_path):
        await _two_models(session, store, graph_id)
        rule = {**ANCHOR, "source": "news-articles:Missing.iso_code"}
        root = _bundle(tmp_path, [rule], DATASETS)

        run = await apply_bundle(session, store, graph_id=graph_id, root=root)

        assert run.skipped == 1
        assert "no node type 'Missing'" in run.outcomes[0].detail
