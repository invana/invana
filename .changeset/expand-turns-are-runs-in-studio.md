---
"studio": minor
"invana": patch
---

Expanding a node in Studio now runs under the world picked in the header, just as an ask does. Each expansion appears in the session as a run: an **Expand** step with its counts, listed in the Tasks tab beside the ask steps. The thread refreshes after every expansion, including empty ones and refusals.

A refused expansion now says why — *This world has no Publisher.* — and a queued one says it is queued. Neither shows as "Failed to load neighbours." The step's node count no longer counts the anchor once per edge.
