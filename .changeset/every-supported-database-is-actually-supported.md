---
"invana": patch
---

Every supported database is actually supported.

Six databases are listed as supported. Until now the connector suite only ever pointed at one backend
per language — Neo4j for openCypher, ArcadeDB for Gremlin — so the other four had never been run. The
suite now runs **every test against every live backend of its language**, and the first run answered
a question nobody had asked: two of the four did not work at all.

**JanusGraph could not return any element that had properties.** Its edge id is a
`RelationIdentifier`, a type of its own, and GraphBinary — the driver's default — cannot carry a type
the client does not know. It does not drop the field; it fails the whole response with
`KeyError: <DataType.custom: 0>`. Even the health check went through it, so nothing worked.
`invana-janusgraph` is now a real package: GraphSON, which passes an unknown `@type` through as a
plain map, plus the serializer that reads `relationId` out of it and the coercion that turns a vertex
id back into the long JanusGraph stores.

**Memgraph could not address an element at all.** The core querysets call `elementId()`, which is
Neo4j 5's function — Memgraph has `id()` and no `elementId` whatsoever. "Standard openCypher" in this
core had quietly meant Neo4j-5 openCypher. `invana-memgraph` is now a real package too, and the fix
needed both halves: naming the function is not enough, because `id(n) = "428"` is not an error on
Memgraph — it matches nothing, and a read that returns no rows because of a type mismatch cannot be
told apart from a record that is not there.

Rather than work either difference around inside a queryset — where every other vendor would inherit
it — the family connectors grew five named seams: `message_serializer()` picks the wire format,
`query_builder` picks the dialect, `coerce_id()` and the serializer's `coerce_element_id()` are the
single boundaries an element id crosses in each direction, and `classify_error()` decides which
failure bucket a vendor's error lands in. `OpenCypherQueryBuilder` became classmethods over one
`ELEMENT_ID` name so a vendor changes a word rather than twenty queries.

Three of those seams found bugs on the way past. `_neighbor_match` was called on the base class, so a
subclass's dialect never reached it. The algorithms queryset wrote its own Cypher and hardcoded
`elementId` four times. And `deserialize_edge` took `raw["eid"]` directly rather than through
`_extract_id`, so the same id was unwrapped when it arrived by one path and stringified when it
arrived by another — which is the shape of bug the funnels exist to make impossible.

Memgraph's missing `shortestPath()` is an override, not a refusal: it spells the same capability
`-[*BFS ..n]-`, and declaring it unsupported would have taken away something the database can do.

All four now pass their whole suite — Neo4j 71, Memgraph 71, ArcadeDB 66, JanusGraph 66. A backend
nothing is listening on skips, naming the compose command that starts it, so a checkout that started
only Neo4j still runs and a real regression is never indistinguishable from a container that was not
started.
