"""Bound: *none* — the entries that spend nothing
(specs/system-design/orchestration.md § The catalogue).

They read what earlier steps left on ``RunVars``, decide something about it and
write it down. No model call, no query, no row anyone has to pay for.
"""
