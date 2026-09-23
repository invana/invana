---
"invana": patch
---

A plan's panel says what it declares and who calls it (LB22).

The Plans drawer's record was a title, an intent, a numbered list of its steps and a run count. It
is now the four bands the board draws:

**The plan** — key, origin, `5 · 4 callables, 1 human`, what it matches, its owner, and the agents
that **may run** it. The steps are not listed again: the flow beside the panel draws them, and a
numbered copy was the same plan said twice in two shapes.

**Layers it declares** — the five governed bands, each with what this plan will engage in it.
Every band appears whether the plan touches it or not: *this plan leaves the graph alone* is the
fact a reader opening somebody else's plan is checking for, and a band that vanished when empty
would be indistinguishable from one that failed to load. An untouched band is dimmed and reads
`—`, never `0 steps`. The spine is not drawn as a sixth row — a plan does not engage the runtime,
the runtime dispatches the plan — and the section says so in a line.

**Used by** — the callers, which means the skills that **inline** this plan through `uses`, each
with the arguments it tuned (LB19). Two skills may inline one plan with different values and
neither is a fork, so the value is what belongs beside the name. An agent whose envelope lists the
plan *may run* it and has not used it; that is a permission and it stays a row in *The plan*.

**How it has behaved** — runs, served and last run, until the plan dashboard carries them (LB10).

Library rows gain the same bands as chips and read *used by N callers*, falling back to how often
they ran where nothing inlines them: *what will this cost me* is the question a library is scanned
with, and a row that answered it only after a click made the list a set of names.

The band a step sits in is derived **once, in the engine** — `runtime/layers.py` maps a catalogue
entry's `bound` onto a governed layer, and the skill's Flow tab, the bind check and the library now
read that one mapping (LB23).
