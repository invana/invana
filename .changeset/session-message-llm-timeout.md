---
"invana": minor
"studio": minor
---

Let natural-language asks set the LLM translation timeout. The composer gains a
per-ask timeout selector (30s / 1m / 2m / 5m, default 2m) shown next to the
model picker in NL mode, and the value flows through `SendMessage.timeout_s` to
the LLM request — so slow local models can be granted more time before the call
gives up. Omitting it falls back to the engine's translate default.

The same budget now also bounds the **query execution**: `timeout_s` is threaded
through `execute_query` into the connector's `execute()` and applied at the
driver — the Cypher connector passes it as the Neo4j transaction `timeout`, and
the Gremlin connector enforces it client-side around the traversal call. The
timeout selector is therefore shown in Query-Language mode too, so a typed query
is bounded just like a translated one.

The chosen timeout is persisted on the assistant message (new `timeout_s`
column) and restored into the composer when the session is reopened, alongside
the existing mode/model restore — so the selection sticks per session instead of
resetting to the default. Re-running a message honours the timeout it was sent
with.
