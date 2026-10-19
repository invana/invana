---
"invana": minor
---

Counts of part of a list are the engine's. The todos list returns `by_status`, the decisions lists `current`, the plan library `packaged`, the agents list `persistent` and `ephemeral`, and the Explorer's type counts `total_nodes` and `total_edges`. Todos *in review* and *running*, *current · recorded* decisions, *packaged* plans, the Agents header and *ephemeral hidden*, and the Explorer footer's node total read them instead of filtering and counting what Studio loaded. The footer's total is now the graph's: hiding a type no longer lowers it.
