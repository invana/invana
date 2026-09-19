---
"invana": minor
---

`invana stitches` — a bundle's rules declare themselves (stitch-models.md C9, ST39–ST43).

The airways demo stated eleven join rules in `stitches.json`, checked all eleven with
`invana datasets check`, and then asked the reader to retype every one of them into the
declare card. A bundle whose rules exist twice is a bundle whose two copies disagree the
first time one of them is edited.

The same file now declares against a Graph:

```bash
invana stitches apply --graph demo/airways --file demos/airways/stitches.json
```

```
airways — 11 rules → demo/airways

  anchors
  ok   A1   Country.iso_code ≡ country.code                  NewsArticles → AirRoutes
  ok   A2   Hashtag.tag ≡ Topic.tag                          Twitter → NewsArticles
  relationships
  ok   R1   City.code -[SERVED_BY]-> airport.code            NewsArticles → AirRoutes
  …

11 rules — 11 declared, 0 already declared, 0 skipped.
Staged — the global model is unchanged until you commit.
```

Every rule lands **staged**, exactly where the declare card leaves one, and `commit` flips
the set in one action — `--commit` does both in the same run. `list` reads the set back and
`discard` drops the staged half. Nothing is inferred on the way in: the CLI calls the same
`declare` the route calls, so both paths write the same rows.

**A manifest names datasets; a stitch binds versions.** Each `<dataset>` resolves through
the `package_id` its own `graph-model.json` carries, then the local model name, then the
Dataset row of that name — and whatever it resolves to has to carry a **published version**,
so a model with only a draft is skipped saying which model to publish. A relationship whose
endpoints are rows binds the dataset that ships them, and is skipped naming what to import
when the Graph has none.

Applying twice declares nothing twice: a rule already stitched is reported as *already
declared*, because re-running after an edit to the manifest is the ordinary case. The exit
code is non-zero only for a rule that could not be declared at all, so a pipeline branches
on it the way it branches on `datasets check`. `--dry-run` says what it would declare and
writes nothing; counting stays where it can be counted — offline in `datasets check`, live
in the declare card.

Also fixes an import cycle that made `invana.events.services` unimportable whenever
`invana.graphs` was imported first, which is what any CLI command and the whole test suite
do.
