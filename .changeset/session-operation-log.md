---
"invana": minor
"studio": minor
---

Log every canvas operation in the session thread (RFC-046).

A session's thread now records the *operations* that change its canvas, not just
composer queries. Node-expands (right-click → expand, and the Fine-tune panel)
are logged as turns showing the generated Cypher/Gremlin they ran, and an
explicit "Load to canvas" is logged as a turn referencing the query it
projected — alongside the existing NL and QL query turns. So the thread is a
complete, replayable log of everything done on the session.

Engine: `session_messages` gains an `operation` column (`expand` | `load`); the
expand endpoints accept an optional `session_id` and record the turn atomically
(the generated traversal is surfaced via `ResultMetadata.query`); a new
`POST /sessions/{id}/operations` records a `load` turn. Operation turns are
excluded from NL translation context so an expand's traversal never leaks into
the model's prompt.

Studio: operation turns render as compact, icon-led entries (distinct from the
user's typed asks) with the same "View query" + meta as any reply, and are kept
out of canvas restore, the composer's mode/model restore, and its ↑/↓ history.
