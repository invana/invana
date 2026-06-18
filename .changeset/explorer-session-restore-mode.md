---
"invana": patch
"studio": patch
---

Explorer: restore a session's original NL/QL mode on reopen.

Reopening a session started in Natural Language used to default to the Query Language box whenever the latest reply errored or was a rerun — the mode was inferred from the assistant's `via` label, which carries no provider signature in those cases. The engine now persists how each ask was started (`mode` = `"nl"` | `"ql"`) on the assistant message and returns it in the message DTO, and the composer reads it directly. The old `via` heuristic remains as a fallback for messages written before this field existed.
