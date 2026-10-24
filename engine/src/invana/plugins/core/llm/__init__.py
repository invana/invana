"""Bound: ``llm`` — the entries that spend a model call
(docs/for-developers/orchestration.md §0.6).

``nl.understand`` reads the ask, ``plan.compose`` serves it, ``nl.translate``
turns it into a query, ``model.propose`` drafts node and edge types. Each is a
**view**: parse args, call one manager in one app, serialise the declared
outputs (docs/for-developers/building-engine/the-runtime-package.md §4).
"""
