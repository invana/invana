---
"invana": patch
---

A world that narrows actually narrows.

A lens says what a run may see. Until it reaches the database that is a promise, not a bound — and
the difference is the whole point of the feature. Rows that come back and are dropped leave the
counts, the aggregates and the schema the generating model saw all outside the slice: a display
filter wearing a bound's name.

`execute(query, …, lens=None)` now takes one, and does three things in one reading of the query
before anything runs. It **composes** the selector into a `WITH * WHERE` barrier, so a row outside
the slice cannot be returned *or counted*. It **rewrites** a whole-element return into the permitted
properties, so `RETURN d` comes back without what the world excludes. And it **rejects** any query
naming an excluded property anywhere — a return item, a predicate, an `ORDER BY`, a projection, or
the inside of an aggregate.

Both halves are required and neither is sufficient. Rewriting alone does not stop `avg(d.revenue)`;
rejecting alone does not stop `RETURN d`.

The rewritten projection is emitted in the serializer's own node and relationship shape, so a
governed node is still a node — on the canvas, in an emission, in the table — rather than every lens
silently retyping a graph answer as a table. And the identity function it writes is read from the
connection's own query builder, because a hardcoded `elementId()` is invalid Cypher on Memgraph:
a bound that fails **open** on exactly one vendor, which is the worst way for this to be wrong and
the hardest to notice. It is proved against Neo4j and Memgraph both, for that reason.

It fails closed. A query whose shape the compiler cannot bound is refused, naming the fragment —
an unlabelled `MATCH (n)`, a dynamic `d[$k]`, `properties(d)`, `RETURN *`, a procedure call,
`collect(d)`. Refusing what it cannot read is what lets a reader do this job where a full grammar
would otherwise be needed, and it is the only direction a bound may fail in. A governed element may
still be counted or identified — `count(d)` leaks no value, and refusing it would cost a real answer
for nothing.

Gremlin refuses instead. A raw Gremlin query is a script, and a script does not parse into a lens,
so there is nothing to compose onto or project. It says so, naming the language, rather than
reporting as applied and enforcing nothing.

Two refusals are deliberately not errors of the usual kind. A lens violation never becomes a
`QueryExecutionError` — nothing ran, and flattening it would lose the property and the rule that
explain it, and tell a reader their query was broken when their world simply does not hold what they
asked for. And a query that is both unreadable *and* names an excluded property is refused for the
exclusion, because *this world does not carry Deal.revenue* tells you what to change and *this shape
cannot be read* does not.

The rewrite is recorded rather than silent: the trace carries `query.generated` and `query.executed`
as two digests, and the step reads *under a lens* when they differ. They are private to the engine —
`ResultMetadata` is serialised to the browser, and the OpenAPI document is the frontend contract, so
a lens surfacing in Studio is a decision the Govern panels make deliberately rather than one that
leaks in behind a field.

Nothing passes a lens yet. Every caller passes `None` until the `Lens` record lands, and an
ungoverned query executes byte-identical with two equal digests. The enforcement is complete and
reachable; what is missing is something to enforce — which is why this could be finished and proved
before a single row of `lenses` exists, and why it had to be.
