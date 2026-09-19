---
"invana": minor
"studio": minor
---

The Graph gets a ceiling, and delegation gets an agent that may use it (docs/for-developers/modules/agents/features/concurrency-and-contention.md).

**A budget bounds one agent. Nothing bounded the Graph.** Ten agents, each inside its own ceiling, were still ten concurrent query loads, ten claims on one provider's rate limit, and ten connections from a pool that has fewer. `graphs.max_concurrent_thinkings` (default 4) and `concurrency_policy` (`queue` · `refuse`) are the outermost bound, in the same family as an envelope and a budget — one level up, and per Graph.

**Queued is a state you can read.** A run over the ceiling joins a queue with a **position**, not a silent pause; a person's question is served before a scheduled run; a delegated child takes a slot like anything else; and cancelling a queued run takes it out of the line so the rest move up. With `refuse`, the refusal names the bound — *"this Graph runs at most 4 thinkings at once, and 4 are running"* — rather than being a generic failure. `GET …/contention` says what is running and what is waiting behind it, and the counts sit under the fields that set them in the Graph's settings form, because a number you cannot see the effect of is a number nobody tunes.

**Delegation is reachable at last.** `spawn_agent · delegate · await_delegations` shipped with no agent allowed to run them, so the path had never actually run. **Coordinator** is now seeded as the one agent that may delegate — not the default, because delegation is the expensive shape: one question becoming four. Its bounds ship with it and are enforced by the interpreter, never by the prompt: depth 2, three children per thinking, and every child's allow-list, skills, budget and LLM a subset of its parent's.

**A delegated child's trace nests inside its parent's**, under the step that spawned it, collapsed and loaded on open — the parent's run is the subject, and the child is a detail of one of its steps.

The delegation path is reachable but still **unexercised against a live provider**: nothing here has yet watched a real model choose to delegate.
