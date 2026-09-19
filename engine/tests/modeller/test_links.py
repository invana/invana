"""Stitching — declared links, and the union they imply.

From stitch-models.md: nothing is inferred (ST1), a link binds published versions
only, a duplicate is refused naming the existing one, and the global model is
derived on read with anchored types counted once (C5).
"""

import uuid

import pytest
import pytest_asyncio

from invana.apps.graphs.models import Graph
from invana.apps.modeller.links import (
    LinkRefused,
    commit_staged,
    declare,
    derive_global_model,
    discard_staged,
    list_links,
    read_preview,
    remove,
    stitch_preview_query,
)
from invana.apps.modeller.versioner import Versioner
from invana.core.auth.models import User


@pytest_asyncio.fixture
async def graph_id(session):
    """A Graph (and its owner) for links to hang off — both FKs are real."""
    user = User(
        username=f"owner{uuid.uuid4().hex[:6]}",
        email=f"{uuid.uuid4().hex[:8]}@invana.test",
        password_hash="x",
        first_name="Owner",
    )
    session.add(user)
    await session.flush()
    graph = Graph(name="finance", slug=f"finance-{uuid.uuid4().hex[:6]}", created_by_id=user.id)
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
class TestDeclaring:
    async def test_an_anchor_binds_two_published_types(self, session, store, graph_id):
        _, news = await _published(session, store, name="NewsArticles", graph_id=graph_id, types=["Company"])
        _, market = await _published(session, store, name="MarketData", graph_id=graph_id, types=["Stock"])

        link = await declare(
            session,
            store,
            graph_id=graph_id,
            kind="anchor",
            source_version_id=news.id,
            source_type="Company",
            target_version_id=market.id,
            target_type="Stock",
            source_property="ticker",
            target_property="nse_symbol",
        )
        assert link.kind == "anchor"
        assert [row.id for row in await list_links(session, graph_id)] == [link.id]

    async def test_the_same_pair_twice_is_refused(self, session, store, graph_id):
        _, news = await _published(session, store, name="News2", graph_id=graph_id, types=["Company"])
        _, market = await _published(session, store, name="Market2", graph_id=graph_id, types=["Stock"])
        common = {
            "graph_id": graph_id,
            "kind": "anchor",
            "source_version_id": news.id,
            "source_type": "Company",
            "target_version_id": market.id,
            "target_type": "Stock",
            "source_property": "ticker",
            "target_property": "nse_symbol",
        }
        await declare(session, store, **common)

        with pytest.raises(LinkRefused) as exc:
            await declare(session, store, **common)
        assert exc.value.error == "link_already_declared"

    async def test_a_draft_cannot_be_stitched(self, session, store, graph_id):
        _, market = await _published(session, store, name="Market3", graph_id=graph_id, types=["Stock"])
        model = await store.create_graph_model(session, name="Drafty", graph_id=graph_id)
        draft = await store.create_version(session, model_id=model.id)
        await store.create_node_type(session, version_id=draft.id, name="Company")
        await session.flush()

        with pytest.raises(LinkRefused) as exc:
            await declare(
                session,
                store,
                graph_id=graph_id,
                kind="anchor",
                source_version_id=draft.id,
                source_type="Company",
                target_version_id=market.id,
                target_type="Stock",
                source_property="ticker",
                target_property="nse_symbol",
            )
        assert exc.value.error == "version_is_draft"

    async def test_an_anchor_needs_a_key_on_each_side(self, session, store, graph_id):
        """ST26 — one name assumed to hold on both sides is not a rule."""
        _, news = await _published(session, store, name="News4", graph_id=graph_id, types=["Company"])
        _, market = await _published(session, store, name="Market4", graph_id=graph_id, types=["Stock"])

        with pytest.raises(LinkRefused) as exc:
            await declare(
                session,
                store,
                graph_id=graph_id,
                kind="anchor",
                source_version_id=news.id,
                source_type="Company",
                target_version_id=market.id,
                target_type="Stock",
                source_property="ticker",
            )
        assert exc.value.error == "key_required_on_each_side"

    async def test_a_relationship_takes_keys_or_a_dataset_never_both(self, session, store, graph_id):
        """ST27 — one edge type with two sources of truth has no rule for which wins."""
        _, brokerage = await _published(session, store, name="Brokerage9", graph_id=graph_id, types=["Order"])
        _, market = await _published(session, store, name="Market9", graph_id=graph_id, types=["Stock"])
        common = {
            "graph_id": graph_id,
            "kind": "relationship",
            "source_version_id": brokerage.id,
            "source_type": "Order",
            "target_version_id": market.id,
            "target_type": "Stock",
            "edge_type": "FOR",
        }

        with pytest.raises(LinkRefused) as exc:
            await declare(session, store, **common)
        assert exc.value.error == "endpoints_required"

        with pytest.raises(LinkRefused) as exc:
            await declare(
                session,
                store,
                **common,
                source_property="instrument_isin",
                target_property="isin",
                source_model_id="orders",
            )
        assert exc.value.error == "keys_and_source_model"

        # W2 — the foreign key is already a property of the records.
        link = await declare(
            session,
            store,
            **common,
            source_property="instrument_isin",
            target_property="isin",
        )
        assert link.source_model_id is None
        assert (link.source_property, link.target_property) == ("instrument_isin", "isin")


@pytest.mark.asyncio
class TestGlobalModel:
    async def test_anchored_types_are_counted_once_but_still_both_exist(self, session, store, graph_id):
        _, news = await _published(session, store, name="News5", graph_id=graph_id, types=["Company", "Article"])
        _, market = await _published(session, store, name="Market5", graph_id=graph_id, types=["Stock"])
        await declare(
            session,
            store,
            graph_id=graph_id,
            kind="anchor",
            source_version_id=news.id,
            source_type="Company",
            target_version_id=market.id,
            target_type="Stock",
            source_property="ticker",
            target_property="nse_symbol",
        )
        # Declaring stages; the union only sees it once it is committed (ST21).
        await commit_staged(session, graph_id)

        global_model = await derive_global_model(session, store, graph_id=graph_id)
        names = [t.name for t in global_model.node_types]
        assert "Article" in names
        assert global_model.model_count == 2
        assert global_model.anchor_count == 1
        # Company and Stock share one entry: the anchor said they are one entity.
        assert len(names) == 2

    async def test_removing_a_link_takes_it_out_of_the_union(self, session, store, graph_id):
        _, news = await _published(session, store, name="News6", graph_id=graph_id, types=["Article"])
        _, market = await _published(session, store, name="Market6", graph_id=graph_id, types=["Stock"])
        link = await declare(
            session,
            store,
            graph_id=graph_id,
            kind="relationship",
            source_version_id=news.id,
            source_type="Article",
            target_version_id=market.id,
            target_type="Stock",
            edge_type="MENTIONS",
            source_model_id="mentions-model",
        )
        await commit_staged(session, graph_id)
        assert "MENTIONS" in [t.name for t in (await derive_global_model(session, store, graph_id=graph_id)).edge_types]

        assert await remove(session, graph_id, link.id) is True
        after = await derive_global_model(session, store, graph_id=graph_id)
        assert "MENTIONS" not in [t.name for t in after.edge_types]
        assert after.link_count == 0


@pytest.mark.asyncio
class TestStaging:
    async def test_a_declared_stitch_is_staged_and_changes_no_answer(self, session, store, graph_id):
        """ST21 — the row exists, and the union does not know about it yet."""
        _, news = await _published(session, store, name="News7", graph_id=graph_id, types=["Article"])
        _, market = await _published(session, store, name="Market7", graph_id=graph_id, types=["Stock"])
        link = await declare(
            session,
            store,
            graph_id=graph_id,
            kind="relationship",
            source_version_id=news.id,
            source_type="Article",
            target_version_id=market.id,
            target_type="Stock",
            edge_type="MENTIONS",
            source_model_id="mentions-model",
        )
        assert link.status == "staged"

        before = await derive_global_model(session, store, graph_id=graph_id)
        assert "MENTIONS" not in [t.name for t in before.edge_types]
        assert before.link_count == 0
        # Counted beside the union, never into it.
        assert before.staged_count == 1

        committed = await commit_staged(session, graph_id)
        assert [link.id for link in committed] == [link.id]
        after = await derive_global_model(session, store, graph_id=graph_id)
        assert "MENTIONS" in [t.name for t in after.edge_types]
        assert after.link_count == 1
        assert after.staged_count == 0

    async def test_discarding_deletes_the_staged_row_and_leaves_the_union_alone(self, session, store, graph_id):
        """A staged stitch was never in the union, so there is nothing to put back."""
        _, news = await _published(session, store, name="News8", graph_id=graph_id, types=["Article"])
        _, market = await _published(session, store, name="Market8", graph_id=graph_id, types=["Stock"])
        await declare(
            session,
            store,
            graph_id=graph_id,
            kind="relationship",
            source_version_id=news.id,
            source_type="Article",
            target_version_id=market.id,
            target_type="Stock",
            edge_type="MENTIONS",
            source_model_id="mentions-model",
        )
        dropped = await discard_staged(session, graph_id)
        assert len(dropped) == 1
        assert await list_links(session, graph_id) == []

        after = await derive_global_model(session, store, graph_id=graph_id)
        assert after.link_count == 0
        assert after.staged_count == 0
        assert "MENTIONS" not in [t.name for t in after.edge_types]


RULE = {
    "source_type": "Theme",
    "source_property": "theme_code",
    "target_type": "Sector",
    "target_property": "gics_code",
}


class TestPreview:
    def test_nothing_resolving_blames_the_rule_not_the_data(self):
        preview = read_preview({"source_total": 40, "target_total": 12, "resolved": 0}, **RULE)
        assert preview.resolved == 0
        assert preview.countable is True
        assert "The rule is wrong, not the data." in preview.verdict
        # Both keys are named — that is the sentence a person has to judge.
        assert "Theme.theme_code" in preview.verdict
        assert "Sector.gics_code" in preview.verdict

    def test_no_rows_on_a_side_is_not_a_verdict_on_the_rule(self):
        """A model is authored before its data lands; that is not a wrong rule."""
        preview = read_preview({"source_total": 0, "target_total": 0, "resolved": 0}, **RULE)
        assert preview.countable is False
        assert "Nothing to count yet" in preview.verdict

    def test_a_partial_match_counts_what_does_not_resolve_and_shows_some(self):
        preview = read_preview(
            {
                "source_total": 40,
                "target_total": 12,
                "resolved": 9,
                "unresolved_sample": ["INFY", "TCS"],
            },
            **RULE,
        )
        assert preview.unresolved_source == 31
        assert preview.unresolved_target == 3
        assert preview.unresolved_sample == ["INFY", "TCS"]
        assert "31 Theme rows carry a theme_code that no Sector.gics_code equals" in preview.verdict


class TestPreviewQuery:
    def test_the_two_sides_read_their_own_key(self):
        """ST26 — the commonest stitch is the one where the names differ."""
        query = stitch_preview_query(
            source_type="Company",
            source_property="ticker",
            target_type="Stock",
            target_property="nse_symbol",
        )
        assert "MATCH (x:`Company`) WHERE x.`ticker` IS NOT NULL" in query
        assert "MATCH (y:`Stock`) WHERE y.`nse_symbol` IS NOT NULL" in query
        assert "unresolved_sample" in query
