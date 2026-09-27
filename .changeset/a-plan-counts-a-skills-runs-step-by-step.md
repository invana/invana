---
"invana": patch
---

A plan page's **Each step** table counts the runs of a skill that inlined the plan, matched on the step
each copied row came from — a skill saved before this reads as a caller until it is saved again. A
question answered mid-step is no longer counted as a retry, and **Bounds it reaches** lists
`max_clarifications` beside `retry`: how often a step asked, and how often it ran out of rounds.
