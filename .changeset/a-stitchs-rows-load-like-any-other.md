---
"invana": minor
---

A stitch whose endpoints are rows finally loads them (load-data.md C7, LD19 · stitch-models.md ST51–ST52).

Two of the three shapes a stitch takes worked. The third — an edge that is its own fact,
with its own rows — could be declared, counted by `invana datasets check`, drawn in Studio
and committed, and its 22 rows sat in `demos/airways/twitter/stitches/ABOUT.json` doing
nothing. `datasets import` read `nodes/` and `edges/`, the commit only joined keys, and no
path carried the file into the database. Declared, and never true.

A dataset now ships those rows in `stitches/<EDGE_TYPE>.json`, in the record shape `edges/`
already uses, and **two moments load them**: committing the stitch reads them from the
dataset's own `storage_uri`, and every later import of that dataset writes them again. Both
are MERGEs, so the second is a no-op.

**The stitch is the check.** The edge type is in neither model — a cross-model edge belongs
to the stitch, not to a domain — so the rows are written only for a declared, *active* link
naming this dataset and this edge type; anything else is reported rather than written.
Endpoints resolve by id against the whole graph and one that resolves nowhere is rejected
naming both, as every other deferred endpoint is.

**A loaded stitch edge is marked as both.** It carries `_inv_origin = "stitch"`, the stitch
id and the rule, *and* the record provenance an import stamps — `_inv_dataset_id`,
`_inv_record_id`, `_inv_file`. It is a record somebody loaded and an edge that exists
because a stitch says so, and a withdrawal takes it with the rest.

The airways demo now runs end to end. All eleven stitches commit and write 435 edges into a
database that previously held three islands, and the README carries the comparison the demo
existed to make: the traversals that were impossible, the hand-written property join that is
the honest alternative, and what the stitch buys over it — recorded once, counted before it
was trusted, marked so it can be explained, and re-applied to every load that follows.
