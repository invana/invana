---
"invana": minor
---

air-routes ships records, not CSV — and gets Namibia back.

air-routes was the one dataset in the airways bundle that only `invana loader` could read,
which made the dataset every stitch points at the one that could not be imported against a
model, validated, or stamped with provenance. Its 61,394 records now ship as
`nodes/<type>.json` and `edges/<edge>.json` with `model.json` carrying the identity keys,
exactly like news-articles and twitter. `generate_records.py --csv` writes the gold CSV back
out for the bulk path, gitignored rather than committed.

The conversion is lossless in both directions, checked record by record through the engine's
own CSV parser: 3,749 nodes and 57,645 edges identical CSV → JSON, and identical again
JSON → CSV. One record per line rather than pretty-printed, so 50,637 routes stay diffable
and the bundle grows 1.9 MB → 5.3 MB instead of an order of magnitude.

**Namibia and North America had lost their codes.** Both are `NA`, and the upstream
conversion read that as NaN, so `country` 3652 and `continent` 3744 shipped with no `code`
at all. Nothing caught it because the bulk loader `CREATE`s — a null property is just a null
property — while the journal `MERGE`s on the identity key, and a null one aborts the entire
write with `Cannot merge the following node because of null property value for 'code'`. The
upstream converter now reads with `keep_default_na=False`, and the two records the existing
CSVs had already lost are repaired on the way through.

The bulk path stays the right one for this dataset — four seconds against several minutes,
because the journal writes one `MERGE` per record and air-routes is mostly its 50,637
routes. Both now work, which is the point.
