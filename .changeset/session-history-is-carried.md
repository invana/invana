---
"invana": patch
---

A session remembers its earlier turns, whatever world it is asked in. A follow-up like *load them on canvas* now always reaches the model with the asks and the queries before it — the last 20 turns, up from 6. A world that does not send `property_values` used to drop the whole conversation; it now sends each quoted literal in an earlier query or clarification as `'…'` and leaves out the rationale, because a turn carries the ask and the query, never the rows.
