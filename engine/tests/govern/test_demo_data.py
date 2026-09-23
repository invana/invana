"""The airways demo, as a fixture — the declared axes, and the worlds that use them.

A demo whose data does not support the thing it demonstrates is a screenshot.
These check the two claims `demos/airways/` makes to the Govern surfaces:

1. Each model declares axes over properties it actually has, and the ones that
   declare *nothing* do so on purpose — `AirRoutes` has no valid time and
   `Twitter` has no geography, which is what gives the demo a real refusal to
   show rather than a happy path only.
2. The worlds in `govern.json` are legal against the guardrails in the same
   file, slice only along axes their models declared, and each one narrows
   something.

They read the demo files directly. If somebody edits the data and forgets the
model, or the model and forgets the world, this is what says so.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from invana.apps.govern.addressing import Layer
from invana.apps.govern.catalogue import Catalogue, Participant
from invana.apps.govern.managers.lens import to_rules
from invana.apps.govern.rules import Effective, Rule
from invana.apps.govern.validate import validate_draft

DEMO = Path(__file__).resolve().parents[3] / "demos" / "airways"
DATASETS = ("air-routes", "news-articles", "twitter", "deals")


def _artefact(name: str) -> dict:
    return json.loads((DEMO / name / "graph-model.json").read_text())


def _govern() -> dict:
    return json.loads((DEMO / "govern.json").read_text())


@pytest.mark.parametrize("dataset", DATASETS)
def test_a_model_declares_axes_over_properties_it_has(dataset: str) -> None:
    """DM6 — a declaration that names nothing is worse than no declaration."""
    model = _artefact(dataset)["model"]
    axes = model.get("axes", {})
    known = {pk["name"] for pk in model["property_keys"]}

    for axis in ("time", "geo"):
        prop = (axes.get(axis) or {}).get("property")
        if prop:
            assert prop in known, f"{dataset} declares {axis} over {prop!r}, which it does not have"
    for dim in axes.get("dims", []):
        assert dim in known, f"{dataset} declares dim {dim!r}, which it does not have"


def test_the_demo_has_a_model_that_cannot_be_sliced_each_way() -> None:
    """The refusals need something to refuse.

    `AirRoutes` is reference data with no valid time, and `Twitter` carries no
    country — so *only declared axes are selectable* (GV14) has two different
    models to bite on, and neither gap is an oversight.
    """
    air_routes = _artefact("air-routes")["model"]["axes"]
    twitter = _artefact("twitter")["model"]["axes"]
    deals = _artefact("deals")["model"]["axes"]

    assert "time" not in air_routes, "air-routes is reference data; a time slice on it should refuse"
    assert "geo" not in twitter, "twitter has no country; a geo slice on it should refuse"
    # And one model declares all three, so the happy path is there too.
    assert deals["time"]["property"] == "signed_at"
    assert deals["geo"]["property"] == "country_iso"
    assert deals["dims"]


def test_the_deals_slice_narrows_to_about_a_quarter() -> None:
    """The slice has to be worth drawing.

    The designs argue about *1,283 rows — not 4,902*. A world that takes 4,902
    rows down to 45 makes the opposite point: it reads as a filter that broke.
    """
    deals = json.loads((DEMO / "deals" / "nodes" / "Deal.json").read_text())
    eu = {"DE", "FR", "NL", "ES", "CH"}
    inside = [
        d
        for d in deals
        if "2026-01-01" <= d["properties"]["signed_at"] <= "2026-06-30" and d["properties"]["country_iso"] in eu
    ]
    assert len(deals) == 4902
    assert 0.2 < len(inside) / len(deals) < 0.35, f"{len(inside)} of {len(deals)} is not a readable slice"


def _catalogue_from_demo() -> Catalogue:
    """The demo's models as the participant catalogue would resolve them."""
    participants = []
    for dataset in DATASETS:
        artefact = _artefact(dataset)
        model = artefact["model"]
        label = f"{artefact['name']}@{artefact['version']}"
        participants.append(
            Participant(
                address=f"graph_data/model/{label}",
                layer=Layer.graph_data,
                sublayer="model",
                name=label,
                label=label,
                axes=model.get("axes", {}),
                properties=tuple(pk["name"] for pk in model["property_keys"]),
            )
        )
    participants.append(
        Participant(
            address="llm/ollama-local/llama-3.3",
            layer=Layer.llm,
            sublayer="ollama-local",
            name="llama-3.3",
            label="llama-3.3",
        )
    )
    return Catalogue(participants=tuple(participants))


def test_every_world_in_the_demo_is_legal_against_its_own_guardrails() -> None:
    """WO3 — a world that cannot legally run is one nobody should be able to save."""
    demo = _govern()
    catalogue = _catalogue_from_demo()

    guardrails = Effective(
        rules=[Rule.from_dict(r) for g in demo["guardrails"] for r in g["rules"]],
        closed_layers={Layer(v) for g in demo["guardrails"] for v in g.get("closed_layers", [])},
    )

    for world in demo["worlds"]:
        result = validate_draft(
            rules=to_rules(world["rules"]),
            cast=world.get("cast", {}),
            closed_layers={Layer(v) for v in world.get("closed_layers", [])},
            guardrails=guardrails,
            catalogue=catalogue,
        )
        assert result.ok, f"{world['name']}: " + "; ".join(r.message for r in result.refusals)


def test_each_world_narrows_something_except_the_one_that_says_it_does_not() -> None:
    """A world called *Everything* narrowing nothing is the point of it.

    Every other one has to do something, or the drawer is four rows that all
    mean the same thing and the demo teaches nothing.
    """
    for world in _govern()["worlds"]:
        narrows = bool(world["rules"] or world.get("closed_layers") or world.get("cast"))
        if world["name"] == "Everything":
            assert not narrows, "Everything is the widest state — inside the guardrails"
        else:
            assert narrows, f"{world['name']} narrows nothing"


def test_the_price_blind_world_excludes_both_numbers() -> None:
    """GV11 — a query may rank by revenue while the value never enters a prompt."""
    world = next(w for w in _govern()["worlds"] if w["name"] == "Price-blind")
    excluded = {p for r in world["rules"] for p in (r.get("properties") or {}).get("exclude", [])}
    assert excluded == {"revenue", "contract_value"}

    deal_props = {pk["name"] for pk in _artefact("deals")["model"]["property_keys"]}
    assert excluded <= deal_props, "a world cannot exclude a property the model does not have"
