---
"invana": patch
---

A Gremlin graph can be asked a question.

`execute()` is the one door an arbitrary query comes through, in both families. On the openCypher
side it has always been open. On the Gremlin side it raised:

```
NotImplementedError: GremlinConnector uses execute_traversal() for bytecode traversals.
Raw string execution is not supported at the base level.
```

Nothing above the graph band calls `execute_traversal` — it is the querysets' own path, and they
build the traversals they send. So for a Graph bound to JanusGraph, TinkerGraph or ArcadeDB, every
natural-language question reached the last step and stopped there: translate ✓, validate ✓, execute ✗.

The door was meant to be open. [Languages](docs/for-developers/modules/graph-connectors/features/languages.md)
C7 has always said *raw queries pass through*, and `query_service` already text-checks a Gremlin
**string** for `.addV(` · `.addE(` · `.property(` · `.drop(` before running it — a guard on a path
that could not be reached.

`GremlinConnector` now submits a raw query as a script, the way `detect_version` already did, over one
client shared with it rather than a WebSocket handshake per question. Parameters ride as Gremlin
**bindings**, so a value is never spliced into the script text — the same guarantee `$p0` gives on the
Cypher side. A failed script evaluation comes back classified as a syntax error and a blown budget as
a timeout, so a Gremlin failure reads the way a Cypher one already does. A server that will not
evaluate scripts at all — Amazon Neptune takes bytecode and its own HTTP API, not Groovy — refuses at
the connector with the vendor named, rather than surfacing a driver error from the wire.

The serializer had the matching hole. It recognised only the projected shapes the querysets build
themselves and returned `records=[]` unconditionally, so a script that returned a count, a map or a
list came back as an empty answer — the one wrong answer that reads like a right one. Vertices, edges
and paths now become nodes and edges, and everything else becomes a record.

Two decisions were written down rather than assumed. `LG5`–`LG8` in *Languages* say which path a
caller is on and why: bytecode for what the engine composes, a script for what a person or a model
wrote. And `CN3` in the module spec — *the core depends on no database driver* — now says what is
actually true: the core carries one **reference** driver per language and no vendor driver. `neo4j`
and `gremlinpython` are what make a language connector complete rather than abstract, which is
`CN2`, and without them every integration would rewrite the same four methods. Six vendors, two
drivers.
