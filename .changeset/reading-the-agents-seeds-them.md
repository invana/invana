---
"invana": patch
---

Fix: the Agents panel 500'd on every graph.

`AgentManager.list_agents` called `self.self.seed_agents(...)` — a typo from the querysets ·
managers · `server/<module>` refactor — so `GET …/agents` raised
`AttributeError: 'AgentManager' object has no attribute 'self'` before it read anything. The
agents list had no test of its own, which is how a one-character slip shipped; `tests/agents` now
has a suite that seeds a graph by listing it and proves a second list does not duplicate them.
