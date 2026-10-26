"""Constraints on properties — written on a draft, enforced by the model's validator.

docs/for-developers/modules/connect-and-model/features/property-constraints.md.
What breaks a constraint today is counted against a live database in
``tests/graph/connectors/opencypher/test_property_constraint_count.py``.
"""

from __future__ import annotations

import pytest

from invana.apps.modeller.schemas import PropertyConstraintSet
from invana.apps.modeller.validator import SchemaValidator
from invana.apps.standards.models import Standard, StandardVersion
from invana.core.errors import ValidationError
from invana.runtime.managers.property_constraints import PropertyConstraintManager

pytestmark = pytest.mark.asyncio

TERMS = [
    {"name": "Seed type", "type": "text", "values": [{"code": "desi"}, {"code": "kabuli"}]},
    {"name": "Notes", "type": "text"},
]


async def _draft(session, store):
    model = await store.create_graph_model(session, name="Chickpea")
    version = await store.create_version(session, model_id=model.id)
    await store.create_property_key(session, version_id=version.id, name="maturity_days", type="integer")
    await store.create_property_key(session, version_id=version.id, name="seed_type", type="string")
    await store.create_node_type(
        session,
        version_id=version.id,
        name="Variety",
        property_mappings=[{"property_key": "maturity_days"}, {"property_key": "seed_type"}],
    )
    await session.commit()
    return version.id


async def _reload(session, store, version_id):
    session.expire_all()
    return await store.get_version(session, version_id)


async def test_a_range_refuses_a_record_naming_it_and_a_flagging_standard_lets_it_land(session, store) -> None:
    version_id = await _draft(session, store)
    standard = Standard(publisher="icrisat", name="CO_338", title="Chickpea ontology", origin="authored")
    session.add(standard)
    await session.flush()
    pinned = StandardVersion(standard_id=standard.id, version=1, terms=TERMS, content_hash="sha256:x")
    session.add(pinned)
    await session.flush()
    standard.current_version_id = pinned.id
    await session.commit()

    manager = PropertyConstraintManager()
    version = await _reload(session, store, version_id)
    await manager.set(
        session,
        version=version,
        body=PropertyConstraintSet(type="Variety", property="maturity_days", kind="range", min=80, max=180, unit="days"),
    )
    version = await _reload(session, store, version_id)
    rule = await manager.set(
        session,
        version=version,
        body=PropertyConstraintSet(
            type="Variety", property="seed_type", kind="standard", standard="icrisat/CO_338", term="Seed type", on_break="flag"
        ),
    )
    await session.commit()
    assert rule.params == {"values": ["desi", "kabuli"]}
    assert rule.standard_ref == "icrisat/CO_338@1"

    validator = SchemaValidator()
    validator.load(await _reload(session, store, version_id))
    (refused,) = validator.validate_vertex_create("Variety", {"maturity_days": 1100, "seed_type": "desi"})
    assert refused.code == "breaks_constraint" and not refused.flag
    assert refused.message == "Variety.maturity_days breaks its constraint 80 – 180 days: 1100"  # noqa: RUF001
    (flagged,) = validator.validate_vertex_create("Variety", {"maturity_days": 110, "seed_type": "pod"})
    assert flagged.flag and flagged.constraint == "CO_338 · Seed type"


@pytest.mark.parametrize(
    ("body", "code"),
    [
        ({"property": "seed_type", "kind": "range", "min": 1}, "range_needs_number"),
        ({"property": "maturity_days", "kind": "range", "min": 9, "max": 1}, "range_inverted"),
        ({"property": "seed_type", "kind": "standard", "standard": "icrisat/none", "term": "x"}, "standard_not_found"),
    ],
)
async def test_a_constraint_the_property_cannot_hold_is_refused(session, store, body: dict, code: str) -> None:
    version = await _reload(session, store, await _draft(session, store))
    with pytest.raises(ValidationError) as caught:
        await PropertyConstraintManager().set(session, version=version, body=PropertyConstraintSet(type="Variety", **body))
    assert caught.value.detail["error"] == code
