"""Govern — what a run may **see**, **use** and **send**.

One record (``Lens``) separated by ``kind`` into a *world* and a *guardrail*
([GV1](docs/for-developers/modules/govern/spec.md)), one grammar over five
layers, and one projection of the ledger (``RunTouch``) that makes the
declaration checkable after the fact.

The module is deliberately thin on tables and thick on resolvers: a rule is an
element of ``lenses.rules``, the cast is four keys, a world's usage is a grouped
read over ``task_runs``, and what a Graph may address at all is computed from
what it already declares
([GV21](docs/for-developers/modules/govern/spec.md)) rather than stored.
"""
