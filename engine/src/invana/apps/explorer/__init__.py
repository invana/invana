"""Explorer node-expand / graph-traversal APIs (docs/for-developers/modules/explore/features/graph-canvas.md).

Typed, read-only, individually-triggerable traversal endpoints that pull a
node's neighbours from the bound graph DB via the connector ``data_reader``
queryset. Distinct from the sessions/NL execution path (docs/for-developers/modules/ask/spec.md) — these are
their own APIs and can be triggered on their own.
"""
