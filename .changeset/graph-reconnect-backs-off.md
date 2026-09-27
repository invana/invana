---
"invana": patch
---

A Graph connection that stays down is retried less and less often — after 1, 2, 4 … seconds up to the configured maximum — instead of every second.
