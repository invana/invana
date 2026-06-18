---
"invana": minor
"studio": minor
---

Let natural-language asks set the LLM translation timeout. The composer gains a
per-ask timeout selector (30s / 1m / 2m / 5m, default 2m) shown next to the
model picker in NL mode, and the value flows through `SendMessage.timeout_s` to
the LLM request — so slow local models can be granted more time before the call
gives up. Omitting it falls back to the engine's translate default.
