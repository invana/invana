"""The stitch address, against real ``model_links`` rows.

The rest of the Govern suite hands the resolvers a hand-built
:class:`Catalogue`, so nothing exercised the query that *builds* one. That is
what hid [GV24](docs/for-developers/modules/govern/spec.md): two links between
the same pair of types collapsed onto one address, and a hand-built fixture
never has two of them.
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.govern.addressing import matches
from invana.apps.govern.querysets.catalogue import CatalogueQuerySet
from invana.apps.graphs.models import Graph
from invana.apps.modeller.models import GraphModel, GraphVersion, ModelLink


async def _link(session: AsyncSession, graph: Graph, version_id: str, **kwargs) -> None:
    session.add(
        ModelLink(
            graph_id=graph.id,
            status="active",
            source_version_id=version_id,
            target_version_id=version_id,
            **kwargs,
        )
    )


@pytest.fixture
async def version(session: AsyncSession, graph: Graph) -> GraphVersion:
    model = GraphModel(graph_id=graph.id, name="Airways", description="", package_id="airways")
    session.add(model)
    await session.flush()
    row = GraphVersion(model_id=model.id, version="1.0.0", status="active", axes={})
    session.add(row)
    await session.flush()
    return row


async def test_two_links_between_the_same_types_are_two_addresses(
    session: AsyncSession, graph: Graph, version: GraphVersion
) -> None:
    """``LINKS_TO`` and ``ABOUT`` are two participants, so they are two addresses.

    ``uq_model_link`` keys a stitch on ``edge_type``, so dropping it from the
    address names both at once — the bug GV24 answers.
    """
    await _link(
        session,
        graph,
        version.id,
        kind="relationship",
        source_type="Tweet",
        target_type="Article",
        edge_type="LINKS_TO",
    )
    await _link(
        session, graph, version.id, kind="relationship", source_type="Tweet", target_type="Article", edge_type="ABOUT"
    )
    await session.flush()

    names = await CatalogueQuerySet().stitch_names(session, graph.id)

    assert sorted(names) == ["tweet_article@about", "tweet_article@links_to"]
    assert len(set(names)) == len(names)


async def test_an_anchor_keeps_the_bare_pair_and_a_rule_can_reach_one_link(
    session: AsyncSession, graph: Graph, version: GraphVersion
) -> None:
    """An anchor carries no edge type, and `@*` reaches a pair's every link."""
    await _link(session, graph, version.id, kind="anchor", source_type="Country", target_type="country")
    await _link(
        session, graph, version.id, kind="relationship", source_type="Tweet", target_type="Article", edge_type="ABOUT"
    )
    await session.flush()

    names = await CatalogueQuerySet().stitch_names(session, graph.id)
    addresses = [f"graph_data/stitch/{name}" for name in names]

    assert "graph_data/stitch/country_country" in addresses
    assert not matches("graph_data/stitch/tweet_article", "graph_data/stitch/tweet_article@about")
    assert matches("graph_data/stitch/tweet_article@*", "graph_data/stitch/tweet_article@about")
    assert matches("graph_data/stitch/*", "graph_data/stitch/country_country")
