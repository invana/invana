"""Domain audit events (RFC-018).

Append-only event log alongside the existing state tables. Every domain-level
write produces an `events` row via the ``emit_event`` helper. Read APIs at
``/api/v1/events`` (superuser) and ``/api/v1/u/{username}/{graphSlug}/events``
(member) drive the Studio's per-graph + platform Events views; SSE companions
push the live tail via Postgres LISTEN/NOTIFY.
"""
