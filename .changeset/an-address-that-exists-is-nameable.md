---
"invana": patch
---

An endpoint's name accepts what its address accepts, so a backfilled endpoint can be edited (PM19).

The provider-split migration names every backfilled endpoint after its vendor kind, so
`claude_agent_sdk` is a real name in a real Graph and `llm/claude_agent_sdk/claude-opus-5` is a real
address — the address grammar has always allowed the underscore. The input pattern did not, which
made that row uneditable rather than its name illegal: the edit form sends `name` on every save, so
changing the base URL of a backfilled endpoint was refused for the name it had just displayed.

`name` is now `^[a-z0-9][a-z0-9_-]*$` in the engine and in Studio's field, with the hint under it
saying so.
