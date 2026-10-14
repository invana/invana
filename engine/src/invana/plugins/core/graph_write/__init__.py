"""Bound: ``graph_write`` — the entries that write to the bound graph database
(docs/for-developers/orchestration.md §0.6).

**This is the bound that matters most to ceiling**: an agent allowed `graph_read`
and not this one cannot change the graph, whatever plan it runs.

`write_graph` and `stitch` are the keys already stored on every load's nodes and
are not renamed (§6.4). `bulk_write` is the fast path, and it declares no
`requires` because nothing validated what it writes.

**The bodies are here, not one import away.** Loading owns no records of its own,
so there is no app to view and nothing for an entry to be thin against
(the-runtime-package.md § 4a). What stays in its own module is what is long
enough to read on its own: `records.py` for validating and writing records,
`stitching.py` for the rules between models.
"""
