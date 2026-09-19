---
"invana": patch
---

The importer holds no order.

`import_dataset` ran a load: validate, write, stitch, record, with a hand-written run row per stage.
It is deleted, along with the `RunTrace` that existed to write those rows. The CLI opens a run
against `model-import@1` and hands it to the runtime, and the order lives in the plan.

What a reader gets from this: a load and a question are now the same kind of thing. Same trace, same
step rows, same cancellation, same envelope checks — not because a second surface was taught to look
like the first, but because there is only one path.

Live progress is unchanged, and now comes from the run's own stream rather than a callback private to
the importer. What you watch while a load runs is the journal it is already writing, so a load read
live and a load read afterwards cannot disagree.

Rejections are reported by the step that records the outcome, which is where they belong: a bad
property is found while validating and an endpoint that resolves nowhere while stitching, so the
grouped report is assembled once, at the end, rather than by whichever stage happened to find the
first of them.
