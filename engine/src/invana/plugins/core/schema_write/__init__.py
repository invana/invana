"""Bound: ``schema_write`` — the entries that touch a model draft
(docs/for-developers/orchestration.md §0.6).

``understand_ask`` binds the draft this run edits; ``validate_proposal`` checks
referential integrity and reconciles the proposal into it. Both write to the
**draft**, never to the bound graph database — that is a different bound and a
different entry.

**This module still reaches three apps** (`llm` · `modeller` · `sessions`),
which is more than an entry-as-a-view may. The span is named in
`tests/golden/test_catalogue.py`'s ``SPANS_ALLOWED`` and closes when
``reconcile_proposal`` moves to an ``apps/modeller`` manager
(docs/for-developers/building-engine/task-model-migration.md § 6.3).
"""
