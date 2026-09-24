---
"invana": minor
---

Expanding a node on the canvas is now a run. Each expansion — all neighbours, by edge type or by node type — opens `expand-neighbours@1` under the canvas session's lens: the session's agent, the world the request names (`lens_id`, new on every expand request) and the Graph's guardrails. The response keeps its shape and adds `run_id`.

The lens is composed into the traversal, never applied afterwards, on OpenCypher **and** Gremlin — so every connector built on either (Neo4j, Memgraph, ArcadeDB, JanusGraph, Neptune, TinkerGraph) inherits it. Types the world does not hold are not traversed. Properties it excludes are not returned. Each type's slice is part of the match, and the count is taken inside the world. An expansion that names a type the world lacks is refused with that type named (`409 outside_lens`), never answered with zero neighbours.

An expansion with a session is a turn in that session, and its step is listed in the session's Tasks tab. The Runs journal leaves canvas and system runs out unless asked with `?interactive=true`. Run history is pruned separately for interactive and other runs, so canvas clicks never push out an import.
