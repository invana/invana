"""Band 0 — infrastructure (docs/for-developers/building-engine/code-shape.md §3).

Configuration, the session factory, the ORM base, logging, telemetry, identity
and the event record. Nothing here imports anything from ``invana`` that is not
``core``, and nothing here has a ``routes.py``.
"""
