"""What breaks a constraint on a property today, counted on each live openCypher backend.

docs/for-developers/modules/connect-and-model/features/property-constraints.md.
The count runs on the unsaved constraint and writes nothing, so the version is
built in memory: a range check reads the version, never the app database.
"""

from __future__ import annotations

import os

import pytest

from invana.apps.modeller.models import (
    GraphVersion,
    NodeTypeDefinition,
    PropertyKeyDefinition,
    TypePropertyMapping,
)
from invana.apps.modeller.schemas import PropertyConstraintSet
from invana.runtime.managers.property_constraints import PropertyConstraintManager

pytestmark = pytest.mark.skipif(
    os.environ.get("INVANA_ALLOW_GRAPH_TESTS") != "1", reason="graph-database tests need INVANA_ALLOW_GRAPH_TESTS=1"
)


def _version() -> GraphVersion:
    key = PropertyKeyDefinition(name="maturity_days", type="integer")
    variety = NodeTypeDefinition(name="Variety", property_mappings=[TypePropertyMapping(property_key=key)])
    return GraphVersion(status="draft", node_types=[variety], edge_types=[], property_keys=[key])


async def test_the_records_outside_a_range_are_counted_and_named(connector) -> None:
    for vid, days in (("ICCV 2", 95), ("JG 11", 1100), ("Pusa 362", 40), ("Annigeri", None)):
        props = {"id": vid} if days is None else {"id": vid, "maturity_days": days}
        await connector.execute("CREATE (n:Variety) SET n = $props", {"props": props})

    check = await PropertyConstraintManager().check(
        None,
        connector=connector,
        version=_version(),
        body=PropertyConstraintSet(type="Variety", property="maturity_days", kind="range", min=80, max=180),
    )
    assert check.counted and check.breaking == 2
    assert sorted(s.record for s in check.samples) == ["JG 11", "Pusa 362"]


async def test_a_range_nothing_breaks_counts_none(connector) -> None:
    await connector.execute("CREATE (n:Variety) SET n = $props", {"props": {"id": "ICCV 2", "maturity_days": 95}})
    check = await PropertyConstraintManager().check(
        None,
        connector=connector,
        version=_version(),
        body=PropertyConstraintSet(type="Variety", property="maturity_days", kind="range", max=180, unit="days"),
    )
    assert check.counted and check.breaking == 0 and check.label == "≤ 180 days"
