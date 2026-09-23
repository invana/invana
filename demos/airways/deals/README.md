# deals — the commercial layer

Sponsorship agreements between carriers and the companies that back them. The other three
datasets in this folder are *observational*: what flies, what got written, what got said.
None of them holds a number anybody would mind sharing — which makes them a poor way to
demonstrate a bound.

This one holds `revenue` and `contract_value`, and that is the whole reason it exists.

| | |
|---|---|
| Model | `Deals` — `Deal` · `Sponsor` |
| Rows | 4,902 deals · 12 sponsors · 4,902 `SPONSORED_BY` edges |
| Window | signed between 2026-01-01 and 2026-12-31 |
| Built by | [`build.py`](build.py) — deterministic, fixed seed |

## What it gives the Govern surfaces

| The demo can show | Because |
|---|---|
| A **property exclusion** that matters | *Price-blind* drops `revenue` and `contract_value`, and a question can still rank by them — used to compute, never to reason ([GV11](../../../docs/for-developers/modules/govern/spec.md)) |
| A **slice** that visibly narrows | *EU · H1 2026* takes **1,283 of 4,902** rows. A world that took 4,902 down to 45 would read as a filter that broke |
| **Egress** with something to cut | `property_values` must not accompany a call to a hosted model |
| A **stitch** across two models | `Sponsor` ≡ `Publisher`, by domain — seven of twelve overlap |

## The declared axes

```json
{ "time": { "property": "signed_at" },
  "geo":  { "property": "country_iso", "vocab": "iso2" },
  "dims": ["channel", "segment", "stage"] }
```

A world may narrow along these and nothing else. Asking for an axis this model never
declared is refused naming the model and the axis
([GV14](../../../docs/for-developers/modules/govern/spec.md)) — and the other three datasets
each leave a gap on purpose, so that refusal has somewhere to land:

| Model | time | geo | dims |
|---|---|---|---|
| `Deals` | `signed_at` | `country_iso` | channel · segment · stage |
| `NewsArticles` | `published_at` | `country_code` | language · sentiment |
| `Twitter` | `created_at` | — *a tweet carries no country here* | lang · sentiment |
| `AirRoutes` | — *reference data has no valid time* | `country` | type · region |

## The keys it shares

Every key is read out of a neighbouring dataset when the data is built rather than typed
twice, so the stitches resolve against rows that exist:

| Property | Read from | Rule |
|---|---|---|
| `Deal.carrier_iata` | `news-articles/nodes/Airline.json` | **R10** `-[FOR_CARRIER]->` |
| `Sponsor.domain` | `news-articles/nodes/Publisher.json` | **A3** `≡ Publisher.domain`, partial |

**A3 is partial on purpose.** Five sponsors back flights and write nothing — a finance
company, a hotel group, a telecom, a payments firm and an energy company — so the anchor
reports *overlap only* rather than a suspiciously perfect join.

## Rebuilding it

```bash
python3 demos/airways/deals/build.py
```

Deterministic: same seed, same bytes. A diff means somebody changed the shape, which is the
point of committing the output beside the generator.
