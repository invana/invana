---
"invana": patch
---

The Inspector reads the stamps that are actually on the element.

`ProvenanceBlock` looked for `_inv_dataset_id` and `_inv_job_id` and bailed to *"No source record"*
when it did not find them. Those stamps were replaced by `_inv_model_id` and `_inv_run_id` when the
graph was restamped, so **every element in a restamped graph reported no provenance** — the one
thing the stamps exist to prevent.

It now reads `_inv_model_id` · `_inv_record_id` · `_inv_file` · `_inv_run_id`, names the model the
record conforms to, and shows the run that wrote it underneath. The name is resolved from the models
list rather than a datasets list, because a record belongs to a model and there is nothing in
between.

The Explorer's type panel and the Inspector rename their props with it: `datasetName` → `modelName`,
`onOpenDataset` → `onOpenModel`.
