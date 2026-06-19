---
"invana": minor
"studio": minor
---

Explorer node expand — graph traversal from the canvas (RFC-035).

Right-click a node to load its neighbours from the bound graph DB — all
neighbours, by neighbour **node type**, or by **relationship type** with
direction (incoming / outgoing / both). A "Fine-tune expand…" panel adds page
size, **multi-property sort** (ordered keys, each asc/desc), and property
filters so a node with 1000+ neighbours loads only the meaningful slice;
results carry a total for "showing X of N" pagination and merge incrementally
into the canvas.

Backed by three focused, individually-triggerable read-only endpoints
(`POST /u/{username}/{graphSlug}/explorer/expand/{neighbors,by-edge-type,by-node-type}`)
over a new connector `data_reader` surface (`read_neighbors*` + `count_neighbors*`),
supported by both Cypher and Gremlin: the query builders gain neighbour-label
filtering, `ORDER BY` / `.order().by()` sorting, offset pagination, and a `SortSpec`
type. Each expand emits a `graph.expand` audit event.

Also fixes the Cypher `data_reader` / `data_writer` querysets, which still
treated `connector.execute()` as returning raw driver records after it was
changed to return a deserialised `GraphResponse` (RFC-025) — they now consume
the `GraphResponse` like the schema reader does.
