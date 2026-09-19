---
"studio": minor
---

Setup is an onboarding wizard, and it teaches (setup.md SU16–SU19).

A new Graph opened on a checklist of four steps whose words it had not met yet — *author a
model*, *bring data in* — and the only way to find out what any of them meant was to do it
and see. The steps have not changed. What surrounds them has.

The graph page now shows an **island**: one card centred on the board, with the board
visible around it. Inside, a stepper on the left says what is left, and the selected step's
lesson fills the right:

```
┌ the island ────────────────────────────────────────┐
│ Stock Market Graph   ▓▓▓▓▓░░░░  2 of 4 required    │
├─ stepper ────────┬─ the lesson ────────────────────┤
│ 1 · CONNECTED    │ Bring data in       step 3 of 4 │
│  ✓ Connect a db  │ ✦ Answers are grounded, or      │
│ 2 · GROUNDED     │   they are refused              │
│  ✓ Author a model│ WHY IT MATTERS · HOW · ⌨ · DONE │
│ ▸◐ Bring data in │ [ Open Imports ]   Skip for now │
└──────────────────┴─────────────────────────────────┘
```

Every step carries the same six fields — why it matters, what it unlocks, two or three
moves, the terminal line with the graph pre-filled, and the fact that proves it landed. No
step gains a form: the primary action still opens the panel that already owns that field.

Each **required** step also teaches the one Invana idea it depends on, where it is about to
be used: *a Graph is a mission, not a database* · *the model is the shared vocabulary* ·
*answers are grounded, or they are refused* · *your key, your provider*. There is no primer
ahead of step one and no glossary — a concept is taught at the step that needs it, or not
at all.

The selected step is `?step=`, so a step can be handed to a teammate. *Previous* and *Next
step* are navigation, not a gate: every step stays selectable in any order, which is what
keeps this a page and not a modal. Below the island's `@3xl` the two panes stack into the
gate-card board — same rows, same URL, one column.

A **graduation cap** now sits in `header.right`, between the GitHub stars and the theme
picker, on graph-scoped routes only. It opens the wizard from anywhere in the Graph, lit
while a required step is outstanding and muted once the Graph is ready — but never gone.
Undoing a skip, reading why a step went broken and going over a concept again all live in
the wizard, and a surface you can only reach while you do not yet understand the product is
the wrong surface to hide. It replaces the link that used to sit on the identity card.

*Graduation* is the icon's metaphor. The state a Graph reaches is still **ready**.
