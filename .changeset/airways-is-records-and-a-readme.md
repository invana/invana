---
"invana": patch
---

airways is records and a README — the generators are gone.

The demo bundle held nine Python files: three `generate_dataset.py`, `generate_model.py`
and `generate_records.py` for air-routes, a shared `_common.py`, and two leftovers
(`sample_format.py`, `usage_example.py`). They rewrote artefacts that are already committed,
so the bundle carried two descriptions of the same data and only one of them was the one
anyone loads. What ships now is what the CLI reads: `nodes/*.json`, `edges/*.json`,
`model.json`, `graph-model.json`, `stitches.json`, `stitches/ABOUT.json`, and a README per
dataset. The records are the source — edit them and re-run `invana datasets check`.

**The bulk path goes with them.** `invana loader` reads CSV, the CSVs were generated on
demand by `generate_dataset.py --csv`, and nothing generates them now — so the walkthrough
loads all three datasets through `invana datasets import`, models first and published first.
air-routes takes minutes rather than the loader's four seconds, because the journal writes
one `MERGE` per record and this dataset is mostly its 50,637 routes. That is the path the
demo is about: validated against a published model, stamped with provenance, and stitchable.

`invana datasets check demos/airways` still reads 3 datasets clean and 11 rules resolving.
