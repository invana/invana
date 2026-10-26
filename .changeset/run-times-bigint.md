---
"invana": patch
---

**A run left open for weeks no longer stops the engine starting.** A run's stored times
(`duration_ms` · `queue_ms` · `work_ms` · `ask_ms` · `wait_ms`) are 64-bit; as 32-bit integers they
held at most 24.8 days, so a run waiting longer on an unanswered ask could not settle, and the
restart sweep that fails such runs crashed startup. Migration `000000000087`.
