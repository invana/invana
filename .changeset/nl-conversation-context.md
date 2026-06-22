---
"invana": minor
---

Sessions: natural-language asks now remember the conversation, so follow-ups refine the previous query.

Ask "show me 10 longest airports" then "only show 5", and the second ask now resolves against the first — previously each NL ask was translated in isolation and the follow-up had nothing to refine. On each NL turn the engine replays a bounded window of the session's recent successful turns (last ~6, both nl and ql) as the user prompt + the generated query + the model's rationale, then translates the new ask with that context (RFC-036). The LLM stays stateless — there is no provider-side session; we replay our own persisted history, which is the only provider-neutral design and keeps sessions private-to-creator and hard-deletable (RFC-024).

The model's one-line `rationale` is now persisted on the assistant message (new nullable column, surfaced in admin) so it can be part of that replayed context. Re-run is unchanged (it never calls the LLM). No Studio change.
