---
"invana": minor
---

A model declares what may be narrowed, and the airways demo has something worth narrowing
(DM6 · DM8 · DM9 · GV4 · GV14).

**Declared axes are real.** A published model version now carries `axes` in its artefact —
which property holds valid time, which holds geography, which are selectable dimensions:

```json
{ "time": { "property": "signed_at" },
  "geo":  { "property": "country_iso", "vocab": "iso2" },
  "dims": ["channel", "segment", "stage"] }
```

They export, import, travel inside the content hash, and are carried forward when a draft
publishes. Empty is the default and means *nothing is selectable* — the model can still be
allowed or denied whole, it simply cannot be sliced. Nothing is inferred from a property's
name or type, because that would make *which rows did this run see* depend on a guess. An
axis naming a property the version does not have is **refused at import**, naming both.

**A rule can name a model across its versions.** `*` inside a segment globs it, so
`graph_data/model/Deals@*` is every published version of `Deals`. Writing the version out
would make a bound that silently stops applying the next time somebody publishes.

**`invana govern`** loads a Graph's bounds from a file:

```
invana govern apply --graph demo/airways --file demos/airways/govern.json
invana govern list  --graph demo/airways
invana govern show  --graph demo/airways --world "EU · H1 2026"
```

Guardrails go in first and the worlds are checked against them — the same order the product
enforces, because a world is validated at save, not at run. Applying is idempotent by name,
so re-running an edited file does what you mean. A refusal prints what the surface would
say, with the bound named.

**The airways demo grows a fourth dataset.** The first three are observational — none of
them holds a number anybody would mind sharing, which made them a poor way to demonstrate a
bound. `deals` holds `revenue` and `contract_value` across 4,902 sponsorship agreements, so:

| The demo can now show | Because |
|---|---|
| A slice that visibly narrows | *EU · H1 2026* takes **1,283 of 4,902** rows |
| A property exclusion that matters | *Price-blind* drops both numbers, and a question can still rank by them |
| Two refusals, not a happy path | `AirRoutes` declares no time axis and `Twitter` no geography, **on purpose** |
| A stitch across two models | `Sponsor` ≡ `Publisher` by domain — seven of twelve overlap, so the anchor is honestly partial |

Thirteen stitch rules now, all resolving. `demos/airways/govern.json` ships the guardrails
and four worlds that narrow within them.
