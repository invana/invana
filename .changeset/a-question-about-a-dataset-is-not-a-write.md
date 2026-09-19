---
"invana": patch
---

A question about a dataset is not a write.

The read-only guard in front of a generated query matched write clauses as bare substrings, so
`OFFSET 10`, `d.dataset` and `n.asset` were all read as `set ` and refused — three read-only queries
that would never write anything. So was every read-only `CALL { … }` subquery, and any question whose
literal contained the word *merge*. A two-leg compare question failed on its second leg for exactly
this reason.

The same trailing space let real writes past: `CREATE(n)` and `MERGE(n)`, written without a space
after the clause, matched nothing. Matching on word boundaries with literals stripped fixes both
directions at once, and `load csv`, `drop` and `foreach` join the list.

`CALL {` is no longer a marker of its own. A subquery that writes says so with a `CREATE` or a `SET`
inside it, which the guard already reads; the brace alone refused every read-only subquery and caught
nothing the rest did not.

And the refusal now reads as what it is. It settles as `query_not_read_only` carrying the query as
evidence — the same cause `validate_query` raises — instead of `llm_failed`, which told the reader
*the model could not produce an answer* and offered to take them to the LLM provider settings. The
model had produced an answer. Invana declined it, and said so as though the provider were broken.
