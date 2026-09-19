"""Band 2 — one folder per product domain
(docs/for-developers/building-engine/code-shape.md §3).

An app owns one product idea, with its models, services and rules. It may
import `core` and `graph`, and it may import another app — but never in a
cycle, and never upward into `runtime`, `server` or `cli`.

The band is in the import path on purpose: `from invana.apps.agents…` inside
`core/` is wrong at a glance, before any linter runs.
"""
