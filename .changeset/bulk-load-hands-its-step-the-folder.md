---
"invana": patch
---

`invana loader` bulk loads work again. `bulk-load@1` was opened with the folder, batch size and error policy on the run's params only, while `bulk_write` reads its step's args — so every bulk run failed with *No folder to load*. The step now carries all four.
