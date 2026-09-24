---
"invana": patch
---

Removing an active stitch is a run, under the Graph's guardrails (ST55).

Deleting an active stitch in the Stitches drawer now opens `stitch-withdraw@1` — one new catalogue
entry, `withdraw_stitch` — instead of deleting its edges straight through the connector. The
Graph's guardrails are asked about both of the stitch's models first: if either is denied, the
removal is refused naming the rule, and the stitch and its edges stay. The rule is removed only
after its edges are withdrawn, so an unreachable or read-only database now refuses the removal
rather than leaving edges behind. Removing a staged stitch is unchanged — it wrote nothing.
