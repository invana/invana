---
"invana": patch
---

Loading is the catalogue, not an app.

`apps/datasets/` held a `stages.py` whose six functions shared their names — and most of their
docstrings — with the catalogue entries that called them. `catalogue/ingest.py` declared a
`validate_records`; so did `stages.py`, one import away, saying the same thing twice because a
pass-through in another package has to re-explain itself to be readable at all.

A catalogue entry is thin when there is an app to be thin against: `llm.py` views `apps/llm`,
`graph_read.py` views `apps/graphs`, and those apps own records, managers and routes that answer
callers who never ran a plan. Loading owns no records. So the bodies move in beside the entries
that name them:

| From | To |
|---|---|
| `apps/datasets/stages.py` | deleted — the four stage bodies are inline in their entries |
| `apps/datasets/importer.py` | `runtime/catalogue/records.py` |
| `apps/datasets/stitches.py` · `stitch_records.py` | `runtime/catalogue/stitching.py` |
| `apps/datasets/bundle.py` | `runtime/catalogue/bundle.py` |
| `apps/datasets/bulk.py` | `runtime/catalogue/bulk.py` |
| `apps/datasets/load.py` | `runtime/catalogue/contract.py` — `LoadVars` beside the `RunVars` that carries it |
| `stages.open_load` | `runtime/services.py`, beside the opener that calls it — it is the prologue, not a step |

The order is still not code: `model-import@1` states `validate_records → write_graph → stitch →
snapshot_model`, and no Python restates it.

`snapshot_model` no longer writes the load's counts onto a Dataset row. `write_graph` and `stitch`
already declare theirs, and a fact with two homes has no rule for which is right.

Two guards caught real things on the way and both are fixed rather than excused: an entry module
may reach one app, and the entries for `ingest` and `graph_write` now reach none; and the two
`select()`s that came along with the moved files are in `DatasetQuerySet` where they belong, which
retires two allow-list entries.
