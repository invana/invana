---
"invana": patch
---

A load runs the plan, instead of being the plan.

Loading a model's records was a 258-line function that held the order in code: validate, then write,
then stitch, then record what landed, with a hand-written run row for each so the trace had something
to show. It produced the right rows and could not be composed, reordered, bounded or read — the shape
of a load existed only as the shape of that function.

The four acts are catalogue entries now, each spending a bound the envelope can ceiling:

- `validate_records` and `snapshot_model` spend **ingest** — they read a source and record what it
  was checked against, and neither touches the graph.
- `write_graph` and `stitch` spend **graph_write**. An agent without that bound cannot run them,
  whatever plan names it.

Both bounds were empty before this, which is why ingestion had nothing to dispatch through.
`check_bundle`, `apply_stitches` and `commit_stitches` join them, taking the catalogue to 21 entries.

The order lives in `model-import@1`, a builtin plan in the library — rows a person can open, not a
function they have to read. A load resolves it by name, freezes it on the run, and the interpreter
walks it exactly as it walks a question.

Records are imported **into a model**, and the model is what holds them. There is no dataset record
between the two: a name and a path are facts about one load, and they ride that run.

Two builtins are deliberately not seeded yet. `bundle-import@1` needs `map_over` — written flat it
is a single-model load with a manifest check on the front, and its stitch would resolve over a
partial graph instead of once over everything. `bulk-load@1` needs `bulk_write`, because the fast
path writes *without* validating and `write_graph` requires validation. Seeding either half-built
would publish a plan something can select.
