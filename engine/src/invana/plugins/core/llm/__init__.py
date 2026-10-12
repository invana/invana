"""Bound: ``llm`` — the entries that spend a model call
(docs/for-developers/orchestration.md §0.6).

``understand_intent`` reads the ask, ``plan_workflow`` serves it, ``translate_thought``
turns it into a query, ``propose_model`` drafts node and edge types. Each is a
**view**: parse args, call one manager in one app, serialise the declared
outputs (docs/for-developers/building-engine/the-runtime-package.md §4).
"""
