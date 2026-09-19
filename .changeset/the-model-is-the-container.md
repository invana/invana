---
"invana": minor
---

The model is the container — `datasets` and `import_jobs` are gone.

Both were records of the loading machinery rather than of the product: one said *this load
happened*, the other said *these records arrived together*. The run answers the first. The model
answers the second, and always did — a dataset bound to exactly one model, carried no shape of its
own, and existed so the importer had somewhere to hang a name and a path.

**Before upgrading, run `invana records restamp --graph <ref> --apply` on every Graph.** Those two
tables are the only mapping from the old provenance stamps to the new ones — `_inv_dataset_id` →
`_inv_model_id`, `_inv_job_id` → `_inv_run_id` — and the *value* changes with the name, because a
job id is not a run id. `restamp` is deleted with the tables it read, so an element still carrying
an old stamp when migration `41` runs is stranded permanently. No migration can check this: the
stamps live in the graph database, which Alembic cannot see.

What moved where:

| What it held | Where it is now |
|---|---|
| `datasets.model_id` | the model **is** the container |
| `datasets.name` · `storage_uri` | that load's run `params` |
| `datasets.record_counts` | what `write_graph` and `stitch` already report |
| `import_jobs` | the run, which every load has been since M11a |

**The journal is one list, filtered by kind.** `GET /runs` takes `?kind=import|bulk|ask` and the
list row carries `kind` and `body`, so a load names what it loaded without a second request. Studio
stopped merging two journals and de-duplicating between them — that merge existed only because a
load was two records.

**`/datasets` and `/datasets/{id}/imports` are removed**, with their admin views. Setup's *data is
in* step reads runs through a `LoadsReader` the caller supplies, rather than importing upward across
a band.

Narrower for now, and deliberately: the Imports surface keeps the journal, the status filter and the
per-run trace, and loses the dataset cards, the validation report and the log band. The report is
`snapshot_model`'s grouped output and the log is `run_logs`; neither is on `/runs/{id}` yet, and
exposing them is SR17's `result.json`.
