---
"invana": patch
---

A stitch names the model whose records ship it.

`model_links.dataset_id` said *which dataset supplies this edge's rows*. A dataset bound to
exactly one model and carried no shape of its own, so the column was the model, reached
through a row that existed to hold a name and a path. It is now `source_model_id`, and the
migration backfills it through `datasets.model_id` while that table is still there.

Three things follow, and one bug is fixed on the way:

- **A folder declares its own model.** `<bundle>/<folder>/graph-model.json` already carried
  the `package_id` and the name, and that is what resolves a manifest's `news-articles:` to a
  model. The Dataset row was the third branch of that lookup, reached only for a bundle that
  ships no `graph-model.json`; it is gone, and the manifest's format does not change.
- **The manifest's `dataset` field is `rows`.** It names the file under the source folder's
  `stitches/` that holds the edge's rows — it never named a Dataset.
- **Committing a rows-sourced stitch works.** `commit_stitches` passed `dataset_id=` to a
  function whose keyword is `model_id`, so committing one from the Stitches drawer or
  `invana stitches commit` raised `TypeError`. No test reached it. The commit now reads the
  folder back from the load that wrote those records, and passes the model.

The Stitches drawer picks a **model** where it used to pick a dataset, and a rule whose rows
are its own fact reads *rows from NewsArticles' records* rather than *records from a dataset*.

Refusals rename with the column: `dataset_on_anchor` → `source_model_on_anchor`,
`keys_and_dataset` → `keys_and_source_model`.
