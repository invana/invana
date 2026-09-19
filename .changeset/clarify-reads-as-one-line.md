---
"studio": patch
---

A reply's timeline says each thing once, and its text hangs off its steps.

Two things read wrong on a turn that pauses to ask something. The reply's text
*is* the question, and the step it paused on already carried it, so the same
sentence appeared twice — once above the timeline, once as `asked: …` under
`Understand`. And that first copy was an elbow-prefixed detail line with
nothing above it to hang from, so it read as indented from nowhere.

A running turn had the same shape of problem: its headline announced the step
that was running (`Understand… 5.0s`) directly above the step list saying
`Understand · claude-opus-5 · reading 0 prior turns · 5.1s`. The spinner is now
the row's gutter marker and the headline is gone — the step list is the live
plan, and only shows `Starting…` in the moment before the first step frame
lands.

The reply's text now comes *after* its step list — the outcome the timeline
produced, rooted by the last step — and is dropped entirely when a step is
already showing it as the question it asked. A reply with no steps at all (a
plain query, a canvas operation log) puts its text in the row body instead of
dangling an elbow. The paused step drops its `needs input · N options offered`
one-liner, since the question and options sit directly beneath it, and the
options render as console lines (`○ Show routes between airports`) instead of
stacked buttons — after answering they stay as the record of what was offered,
with the picked one filled in.

**Load to canvas** follows the same grammar: it is a question the reply asks on
its own line — `Returned 10 nodes and 0 relationships. [Load to canvas]` —
answered by clicking, with `└ you loaded this to canvas` recorded underneath.
The bordered `10 nodes · 0 edges` panel it used to sit in is gone; those counts
were already in the reply text and in the `Project` step right above it.
