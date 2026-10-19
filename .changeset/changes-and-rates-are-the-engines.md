---
"invana": minor
---

Changes, rates and shares are the engine's. A number compared with its prior comes back as one `Change` — how much, which way, and whether that is better or worse — on the Agents overview and performance pages, eval runs (draft against live), plan versions and model growth. Rates, shares and classifications (`applied_rate`, `error_rate`, caller shares, queries a day, `wide`, `rare`, `slow`) and the counts the Modeller showed (drift, draft added/changed/removed, compare, lens rules and people) are returned by their endpoints, and Studio formats them instead of working them out. `RecentChange.p95_change` is now a `Change` object rather than a number.
