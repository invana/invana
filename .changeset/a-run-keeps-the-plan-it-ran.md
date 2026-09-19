---
"invana": patch
---

A run keeps the plan it ran.

`plan_origin` and `plan_snapshot` answer different questions — *where did this flow come from* and
*what was the flow* — and since the run tables were merged, every run had been answering only the
first. The interpreter wrote the frozen plan to `th.plan`, and there is no such column: the runs
table calls it `plan_snapshot`, because `plan` already names the record, the role, a catalogue key
and the document. Python accepted the assignment, SQLAlchemy never persisted it, and nothing raised.

Of 40 runs on a working install, 3 carried a plan — all of them older than the merge.

What was lost with it:

- **A trace could not be replayed.** The run recorded that `nl-single@1` answered and not what
  `nl-single@1` was at the time, so a plan edited afterwards silently rewrote the history of every
  run that had used it.
- **Promotion was broken outright.** Offering a run that served as a library entry means copying its
  plan into that entry, so the candidate query filters on having one — through the same missing
  column, which raises rather than returning nothing.

The frozen plan is written to `plan_snapshot`, the candidate query reads it, and a run's steps now
carry the library node each came from, so the snapshot freezes the rows rather than a copy of them.

A test asserts that every attribute the interpreter writes on a run is a mapped column. The rename
that caused this compiled, type-checked and ran; the only thing that catches the next one is
checking the mapping rather than the behaviour.
