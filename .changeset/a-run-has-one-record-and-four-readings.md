---
"invana": minor
"studio": minor
---

A run has one record and four readings (docs/for-developers/modules/operate/features/see-what-ran.md SR46–SR53).

**The reading is a switch, not a page.** `In order · Layers · Flow · Lens` sit in the run page's segmented slot over one `GET …/runs/{id}/trace`. Four pages would be four fetches, four URLs and four places for the same fact to drift. A *step* is still a page, because it is a different subject.

**`In order` is the default, and a row is a step.** The layer a step spent is a column on the row, never an axis of its own: a step touches exactly one layer, so a six-band matrix was 1/6 full by construction and a name along the top could not say how long anything took. What those bands answered — *what did this touch at all* — is a summary question, so it collapses to one strip above the list. A bounded repetition is drawn as a box **around** its rounds, so a list nests for free; a gate belongs to no step, so it is a full-width rule **between** two rows, with its chip on the side the cost falls on.

**`Layers` is the plan's strip in the run's tense**, and it has two groupings. By participant, or by the execution tree — attempts under their step, a delegated run under the step that spawned it. Same trace, same clock, same component; only the label column changes. It can also draw the plan's `p50` on the run's own axis, so an overrun is visible rather than arithmetic — and the one thing the record cannot forecast, how long a person takes to approve, draws dashed and says so rather than guessing.

**`Flow` is shape, not numbers, and read-only**: the round that went back, the attempt that stuck, the branch this run never took. A selected node gets a ring and no drag handles. **`Lens` is a reading of the run, not of the world**: allowed · touched · never touched · refused, struck in place rather than hidden, naming the three acts it supports — narrow, widen, or accept *cannot answer* deliberately.

Drawn as thirteen artboards on the `Operate › Runs` canvas page, which replaces the `redesignd` page (docs/for-developers/the-screens.md).
