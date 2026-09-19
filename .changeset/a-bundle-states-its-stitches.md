---
"invana": minor
---

`invana datasets check` — a bundle states its stitches, and the CLI resolves them (load-data.md C10, LD12–LD14).

The airways demo checked its own join rules with a Python script that hardcoded every one
of them: which datasets, which properties, which direction. It worked, and it was useless
to the next demo, which would have had to write its own.

A **bundle** — a folder of datasets that belong together — now states its rules in a
`stitches.json` at its root, in the vocabulary `POST …/model-links` already uses: `kind`,
`source`, `target`, `identity_match`, `edge_type`, `dataset`. Endpoints are written
`<dataset>:<Type>.<property>`, a key on each side (ST26).

```bash
invana datasets check demos/airways
```

```
airways — 3 datasets, 11 rules

  datasets
  ok   air-routes                                   3749 nodes, 57645 edges
  ok   news-articles                                253 nodes, 573 edges
  ok   twitter                                      244 nodes, 525 edges
  anchors
  ok   A1   Country.iso_code ≡ country.code              44/44 keys     44 rows
  ok   A2   Hashtag.tag ≡ Topic.tag  (ci)                10/16 keys     16 rows
       overlap only: airports, avgeek, aviation, flightdelay, paxex, upgraded
  relationships
  ok   R1   City.code -[SERVED_BY]-> airport.code        63/63 keys     63 rows
  …

3 datasets, 3 clean · 11 rules, 11 resolve.
```

**Structure first, then the joins.** Each dataset is validated against its own
`graph-model.json` and `model.json` before a single rule is resolved — ids unique, the
identity key present and unique, every property declared on its type, enum values in range,
declared types honoured, and each edge landing on the source and target types it names. A
rule that fails because a type is malformed should say the type is malformed, not that the
rule matched nothing, and a structural failure counts toward the exit code exactly as a
rule failure does. An endpoint outside its dataset resolves across the bundle and, if it is
still missing, is reported as **deferred** rather than failed — offline, a missing endpoint
is a question only the import can answer (LD16).

It is a **preflight**: it reads files and never opens a Graph, a connection or a database,
and it declares nothing — declaring a stitch is still Studio and the API, so stitch-models'
CLI column stays `—`. It reads whichever shape a dataset ships, `nodes/<Type>.json` or
`nodes/<type>.csv`, so a bundle is checkable whichever path it loads through, and `--json`
gives the same report for a machine.

Counts are **distinct key values**, because that is what the preview reports: 26 airlines
share 24 hub codes, and a rule that read 26 here and 24 in Studio would be the same rule
told two ways. A rule may declare `"partial": true` when the two sides are meant to overlap
rather than match — six hashtags have no story filed under them, on purpose — and without
it a single unresolved value fails the rule, so a silent partial match cannot pass
unnoticed. A non-zero exit makes it a CI check as much as a terminal one.
