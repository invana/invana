---
"invana": patch
---

The model page's **Database** tab reads what the database holds — labels, relationship types,
indexes and constraints — and marks each row against the models: `in both`, `model only` or
`database only`, unmodelled rows first (1.8 · MP9). The counts are live and the rows are the last
`Introspect`'s, with when it was captured and `Introspect` beside it. At one model it shows only
what that model declares.

A connector that cannot list its indexes and constraints now says so — *TinkerGraph does not report
indexes* — instead of answering an empty list (MP26). Memgraph lists them, through `SHOW INDEX INFO`
and `SHOW CONSTRAINT INFO`. A relationship a stitch writes counts as declared by that stitch (MP29).
The Overview gains a **Drift** tile and a drift column per model.

New read: `GET /api/v1/u/{username}/{graphSlug}/schema/physical?model=`.
