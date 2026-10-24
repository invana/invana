"""Bound: ``work_write`` — the entries that create work
(docs/for-developers/orchestration.md §0.6).

Making a child agent, opening a run under it, and filing a Task for a person
are the three acts that create work nobody has yet paid for — which is why they
share a bound the budget ceiling can see.

**This module reaches two apps** (`agents` · `work`). The span is named in
`tests/golden/test_catalogue.py`'s ``SPANS_ALLOWED`` and closes when
``delegate`` and ``work.create_task`` merge into one entry
(docs/for-developers/building-engine/the-runtime-package.md § 6.2).
"""
