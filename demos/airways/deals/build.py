#!/usr/bin/env python3
"""Build the ``deals`` dataset — the commercial layer the Govern demo narrows.

The other three datasets in this folder are *observational*: what flies, what
got written, what got said. None of them holds a number anybody would mind
sharing, which makes them a poor demonstration of a bound. This one holds
``revenue`` and ``contract_value``, and that is the whole point of it —

- **a property exclusion** has something to exclude (the *Price-blind* world),
- **egress** has something it must not send (``property_values`` to a hosted model),
- **a slice** has a time and a geography that actually narrow the rows,
- and a **stitch** has two models that were authored apart and mean the same
  thing in one place (``Sponsor`` ≡ ``Publisher``, by domain).

Every key it emits is read out of the neighbouring datasets rather than typed
twice, so the stitches resolve against rows that exist:

``carrier_iata``  from ``news-articles/nodes/Airline.json``
``domain``        from ``news-articles/nodes/Publisher.json``

Deterministic — a fixed seed, so re-running it produces the same bytes and a
diff means somebody changed the shape.

    python3 demos/airways/deals/build.py
"""

from __future__ import annotations

import json
import random
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
NEWS = HERE.parent / "news-articles" / "nodes"

SEED = 20260920
# Sized so a slice is worth drawing. The Govern designs argue about *1,284 rows
# — not 4,902*, and a demo where the narrowing takes 940 rows down to 45 makes
# the opposite point: it looks like a filter that broke rather than a world.
DEALS = 4902

# One year, so H1 against H2 is the obvious half and `select.time` has an
# honest 50/50 to bite into.
WINDOW_FROM = date(2026, 1, 1)
WINDOW_TO = date(2026, 12, 31)

# The book is European-heavy, which is what makes *EU · H1 2026* a real slice
# rather than a rounding error. Every other carrier shares what is left.
EU_CARRIERS = {"DE", "FR", "NL", "ES", "CH"}
EU_SHARE = 0.52

# Deliberately more than the seven publishers: five sponsors have no newsroom
# behind them, which makes the anchor **partial** and gives the demo an honest
# "overlap only" line rather than a suspiciously perfect join.
UNMATCHED_SPONSORS = [
    ("SPN_08", "Meridian Financial", "meridianfinancial.com", "UK", "financial"),
    ("SPN_09", "Kestrel Hotels", "kestrelhotels.com", "DE", "hospitality"),
    ("SPN_10", "Northwind Telecom", "northwindtelecom.com", "NL", "telecom"),
    ("SPN_11", "Orbit Payments", "orbitpayments.com", "SG", "financial"),
    ("SPN_12", "Verdant Energy", "verdantenergy.com", "FR", "energy"),
]

CHANNELS = ["direct", "agency", "programmatic"]
SEGMENTS = ["enterprise", "mid-market", "regional"]
# A pipeline, not a set: `stage` is a dimension somebody slices by, and the
# order it is written in here is the order the drawer shows it.
STAGES = ["prospect", "negotiating", "signed", "renewed", "lapsed"]


def _load(name: str) -> list[dict]:
    return json.loads((NEWS / name).read_text())


def build() -> None:
    rng = random.Random(SEED)

    airlines = _load("Airline.json")
    publishers = _load("Publisher.json")

    # One weight per airline, so `rng.choices` does the book's shape in one call
    # rather than a branch per deal.
    eu = [a for a in airlines if a["properties"]["country_code"] in EU_CARRIERS]
    rest = [a for a in airlines if a["properties"]["country_code"] not in EU_CARRIERS]
    weights = [EU_SHARE / len(eu)] * len(eu) + [(1 - EU_SHARE) / len(rest)] * len(rest)
    book = eu + rest

    # ── sponsors ─────────────────────────────────────────────────────────────
    # The first seven are the publishers, by domain. Same company, said twice by
    # two teams who never spoke — which is exactly what a stitch is for.
    sponsors = [
        {
            "id": f"SPN_{i + 1:02d}",
            "properties": {
                "name": pub["properties"]["name"],
                "domain": pub["properties"]["domain"],
                "country_iso": pub["properties"]["country_code"],
                "sector": "media",
            },
        }
        for i, pub in enumerate(publishers)
    ]
    sponsors += [
        {
            "id": sid,
            "properties": {"name": name, "domain": domain, "country_iso": country, "sector": sector},
        }
        for sid, name, domain, country, sector in UNMATCHED_SPONSORS
    ]

    # ── deals ────────────────────────────────────────────────────────────────
    span = (WINDOW_TO - WINDOW_FROM).days
    deals: list[dict] = []
    sponsored_by: list[dict] = []
    for_carrier: list[dict] = []

    for n in range(1, DEALS + 1):
        airline = rng.choices(book, weights=weights)[0]
        sponsor = rng.choice(sponsors)
        signed = WINDOW_FROM + timedelta(days=rng.randint(0, span))
        stage = rng.choices(STAGES, weights=[14, 18, 34, 22, 12])[0]

        # Contract value is the whole commitment; revenue is what has landed
        # against it. A lapsed deal recognises less than it signed for, which is
        # the kind of thing somebody would want to rank by without letting the
        # number itself reach a model.
        contract_value = rng.randrange(40_000, 2_400_000, 5_000)
        recognised = {
            "prospect": 0.0,
            "negotiating": 0.0,
            "signed": rng.uniform(0.25, 0.7),
            "renewed": rng.uniform(0.7, 1.0),
            "lapsed": rng.uniform(0.1, 0.5),
        }[stage]

        deal_id = f"DEAL-{n:04d}"
        deals.append(
            {
                "id": deal_id,
                "properties": {
                    "deal_id": deal_id,
                    "carrier_iata": airline["properties"]["iata"],
                    "sponsor_id": sponsor["id"],
                    # `country_iso` is the *carrier's* country, so a geo slice
                    # narrows by where the airline is, not where the sponsor is.
                    "country_iso": airline["properties"]["country_code"],
                    "stage": stage,
                    "channel": rng.choice(CHANNELS),
                    "segment": rng.choice(SEGMENTS),
                    "contract_value": contract_value,
                    "revenue": int(contract_value * recognised),
                    "currency": "EUR",
                    "signed_at": signed.isoformat(),
                    "term_months": rng.choice([6, 12, 12, 24, 36]),
                },
            }
        )
        sponsored_by.append({"from": deal_id, "to": sponsor["id"]})
        for_carrier.append({"from": deal_id, "to": airline["properties"]["iata"]})

    (HERE / "nodes").mkdir(exist_ok=True)
    (HERE / "edges").mkdir(exist_ok=True)
    _write(HERE / "nodes" / "Deal.json", deals)
    _write(HERE / "nodes" / "Sponsor.json", sponsors)
    _write(HERE / "edges" / "SPONSORED_BY.json", sponsored_by)
    _write(HERE / "edges" / "FOR_CARRIER.json", for_carrier)

    _report(deals, sponsors, publishers)


def _write(path: Path, rows: list[dict]) -> None:
    path.write_text(json.dumps(rows, indent=2) + "\n")


def _report(deals: list[dict], sponsors: list[dict], publishers: list[dict]) -> None:
    in_window = [
        d
        for d in deals
        if "2026-01-01" <= d["properties"]["signed_at"] <= "2026-06-30"
        and d["properties"]["country_iso"] in EU_CARRIERS
    ]
    pub_domains = {p["properties"]["domain"] for p in publishers}
    overlap = sum(1 for s in sponsors if s["properties"]["domain"] in pub_domains)

    print(f"{len(deals)} deals, {len(sponsors)} sponsors")
    print(f"  EU · H1 2026 slice: {len(in_window)} of {len(deals)} rows")
    print(f"  Sponsor ≡ Publisher: {overlap}/{len(sponsors)} keys overlap")


if __name__ == "__main__":
    build()
