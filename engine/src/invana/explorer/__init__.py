"""Explorer node-expand / graph-traversal APIs (RFC-035).

Typed, read-only, individually-triggerable traversal endpoints that pull a
node's neighbours from the bound graph DB via the connector ``data_reader``
queryset. Distinct from the sessions/NL execution path (RFC-024) — these are
their own APIs and can be triggered on their own.
"""
