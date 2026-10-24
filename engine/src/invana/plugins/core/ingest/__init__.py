"""Bound: ``ingest`` — the entries that read a source and decide what may land
(docs/for-developers/orchestration.md §0.6).

**The keys are the ones already stored** on every load's nodes —
`data.records.validate` is not renamed to `import_dataset` (§6.4).

Reading a folder is `ingest`, not `graph_read`: nothing here touches the bound
database. What lands is `graph_write`, and it is a separate ceiling for exactly
that reason.

**The bodies are here, not one import away** (the-runtime-package.md § 4a).
"""
