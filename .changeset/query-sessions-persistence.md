---
"invana": minor
"studio": minor
---

Persist query sessions end-to-end (RFC-024).

The Explorer's Sessions panel is now backed by the engine instead of browser
memory. A new `sessions` + `session_messages` data model stores each threaded
ask/answer against a graph — graph-scoped, private to its creator, hard-CASCADE
on graph or user deletion, metadata only (no result-payload snapshots).

The standalone `POST .../query` route is **removed**; its execution core moves
to a shared `execute_query` service, and sessions become the only execution
entry point:

- `GET/POST /sessions`, `GET/PATCH/DELETE /sessions/{id}`
- `POST /sessions/{id}/messages` — append a user message, run it, append the
  assistant reply
- `POST /sessions/{id}/messages/{messageId}/run` — re-execute a past message's
  query in place (repaints the canvas) without appending a new message

`session.create` / `session.delete` audit events are added and `query.execute`
now carries `session_id`. `Session` and `SessionMessage` are inspectable in the
admin. Studio's `useSessions` now reads/writes via TanStack Query, sessions
survive reloads, and reopening a session re-runs its latest query to restore the
canvas. Natural-language asks are recorded with an explanatory reply but not yet
executed.
