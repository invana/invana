"""Standards (install-wide) — docs/for-developers/modules/bring-data-in/features/standards.md.

A versioned set of terms — type, required, allowed values — that datasets claim
and are scored against. Above Graphs: routes live at ``/api/v1/standards/…``.
A dataset's claim and its conformance are ``apps/datasets``'s, which reads this
app and is never read by it.
"""
