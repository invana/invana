---
"invana": minor
"studio": minor
---

A load is a run you can read (docs/for-developers/modules/bring-data-in/spec.md).

**`--model` is required, and it names a model somebody authored.** `invana datasets import --graph <ref> --model <name> --name <dataset> --path <folder>` validates every record against that model's **active version** and never derives a schema from the data. A model with nothing published refuses the load rather than inventing one; a read-only connection refuses it naming the setting. `--max-rejected` gives a scheduler an exit code to branch on.

**An import is a thinking.** Every run opens `Thought(kind = "import")` and a `Thinking(workflow_key = "dataset-import@1")` whose four steps — `validate_records · write_graph · stitch · snapshot_model` — are written directly rather than planned, because there is nothing for a model to decide about a load. What that buys is the trace: an import shows up in the same step card an answer does, with the same statuses, timings and failure vocabulary, so Studio grows no second run UI.

**Rejections group by reason.** One bad column is one line with a count and a few sample rows, not four thousand lines — on the CLI and at `GET …/datasets/{id}/jobs/{job_id}/report`. An edge whose endpoints resolve neither in the dataset nor in the graph is rejected **naming both**; a dangling edge is never written. An endpoint the dataset does not carry but the graph already holds is resolved by the `stitch` step instead of being rejected.

**Provenance goes both ways.** Every written element carries `_inv_dataset_id`, `_inv_record_id`, `_inv_file` and `_inv_job_id`, so the node inspector reads *where this came from* off the node it already has — no request — and `GET …/datasets/{id}/records/{record_id}` answers the other direction. An element with no stamps says so: it came from `invana loader`, the fast path, which produces no run and no provenance.

**Studio: Datasets is a view, not a setting.** It moves to the top rail and reads what landed — *Validated against `NewsArticles @ v3`*, the per-type counts, the run's own step card, and *"7 records failed validation and were reported, not written"*. Nothing on it writes: import is CLI and API, and the status bar says so rather than leaving a person hunting for an upload button.
