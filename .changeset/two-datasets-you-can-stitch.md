---
"invana": minor
---

Two datasets you can actually stitch — news-articles and twitter (stitch-models.md, Fixtures).

Stitching had nothing to be tried on. `datasets/` held three unrelated graphs, and air-routes
— the one everybody loads — carried no model at all, so there was never a second published
version to link to. **news-articles** (aviation coverage: articles, outlets, carriers, routes,
cities, countries) and **twitter** (posts, accounts, hashtags) now sit beside it as one story
told from three angles, and air-routes gains an authored `graph-model.json` so it can be the
other side of a link.

The keys are **read out of the neighbouring dataset at generation time, never retyped** —
airport codes and country codes out of air-routes, article URLs and topic tags out of
news-articles. So a declared rule resolves against rows that exist: 63/63 cities onto
airports, 65/65 post links onto articles, 26/26 airline accounts onto carriers.
`invana datasets check demos/airways` counts every rule without a database, and the six
hashtags with no topic behind them are deliberate — a fixture where everything matches
teaches nothing about a preview.

Ten stitches, covering every shape: W1 (`Country.iso_code ≡ country.code` — a key on each
side), an anchor matched `case_insensitive`, W2 (a foreign key already on the records) and
W3 (endpoints arriving in their own dataset, `twitter/stitches/ABOUT.json`). Only two are
anchors, because an anchor is type-level and a city is not an airport.

Each dataset folder holds **one copy** of its records — `nodes/*.json` + `edges/*.json` +
`model.json` for `invana datasets import`, and `graph-model.json` for `invana models import`.
`generate_dataset.py --csv` writes the gold-standard CSV `invana loader` reads, gitignored
rather than committed: a second copy of the same records is a copy that can disagree with
the first, and the bulk path writes no model, so what it loads cannot be stitched at all.
air-routes now ships the same way.
