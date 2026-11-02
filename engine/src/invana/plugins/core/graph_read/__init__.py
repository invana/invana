"""Bound: ``graph_read`` — the entries that read the bound graph database
(specs/system-design/orchestration.md § The catalogue).

Five entries: a query somebody wrote, a neighbourhood the canvas asked for,
the types a world holds, whether a canvas's elements are still in view, and
what a stitch rule would resolve.
Dialect is a connector concern, not a catalogue one: Gremlin does not get a
second key.

This is where a run engages the ``graph_data`` layer, so it is where the lens
bites — through the contract's ``open_graph`` / ``close_graph``, which own what
a crossing *is* so that an entry stays a view over one app. The version is
checked before the query is sent, the narrowing is handed to the connector as a
``QueryLens``, and one touch is recorded carrying both digests. **Nothing is
enforced by filtering afterwards**
([govern § The one record](specs/system-design/modules/govern.md#the-one-record)).
"""
