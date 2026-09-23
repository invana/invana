---
"invana": patch
---

A plan every row of which is a person's is written, not refused (SK15).

**Edit by hand** on a plan whose rows are all `form: human` was refused with *This plan does
not hold together: the plan has no steps* — while the rows were plainly there on the screen.
The hand-edit route hands the envelope only its **callable** rows, so a plan of people's
steps arrives as an empty list, and the validator reads an empty list as
[`the plan has no steps`](../engine/src/invana/apps/agents/envelope.py) — the one reading it
must not have here.

It is not a corner case. `form: human` is the universal fallback
([SK15](../docs/for-developers/modules/skills/features/authoring-a-skill.md#decisions)), a
catalogue gap must never block publishing, and the plan every draft is **born** with
([SK22](../docs/for-developers/modules/skills/features/authoring-a-skill.md#decisions)) is
exactly one such row — so the first hand-edit of a new skill hit it.

The envelope is now skipped when there is nothing callable to check. Nothing else moves: the
genuinely empty plan is still refused a line earlier, in its own sentence — *a playbook with
no steps is not a skill, it is a rule* — and a plan with one callable row is validated as
before.

Found by driving **Graph → Skills → Playbook → Edit by hand** in the browser.
