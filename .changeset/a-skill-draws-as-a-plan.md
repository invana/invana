---
"invana": minor
---

A skill draws as a plan (skills-draw-as-plans.md · M8).

A skill was prose. The **Flow** tab said so, and the Playbook tab could not show which step a
sentence produced, because a version had nothing to produce one into. Now every version owns
exactly one `TaskPlan`, and the surface reads rows instead of naming what it lacks.

```
skill_versions.plan_id     NOT NULL, UNIQUE, → task_plans   one version, exactly one plan
skill_versions.published_at  nullable                        null is the draft
skills.origin                builtin | authored              the playbook the product ships
skill_version_clarifications                                 what was asked, and answered
```

**A draft is a row, not form state.** A version with no `published_at` is what a person is still
writing — the one mutable version row there will ever be. It carries the plan being drawn and the
question the planner stopped on, so a clarification survives a reload and an answer is part of what
publishes. Publishing stamps that row and moves the head: text, answers and plan as one act.

**Nothing is guessed.** `draft_plan` is a new catalogue entry (`bound: llm`) that reads the playbook
sentence by sentence and returns the *candidates* each one has. One candidate is a step, and the
sentence becomes its `source_span`. **Two or more stops** — the question is recorded against that
sentence, offering the readings, each naming the step it would write, and no plan is written until it
is answered. None is a `form: human` step, because a person can always do it, so a catalogue gap
never blocks publishing. A sentence that is not an instruction produces no step and reads as
*unmapped*. Drawing is an ordinary `role = plan` run: it takes a slot, records its exchange, and
appears in Runs like anything else.

**The product's own playbook is now a skill.** *Answer in natural language* is seeded into every
Graph with `origin: builtin` — the five tasks the runtime has always walked, each carrying the
sentence it was drawn from. It is editable: publishing v2 over it is an ordinary act, and it cannot
be deleted. A capability Invana ships and one a person writes are the same record, which is the only
way the surface can be honest about either.

Studio: the **Flow** tab draws the plan in the six layers it will touch, the **Playbook** tab shows
each sentence beside the step it produced and marks the ones that produced none, and the draft
carries *Draw this*, the clarification card and *Publish v{n}*. The drill-in crumb and the `+` move
into the stack drawer's own header — a drawer has one header with one action area, and a create
button floating above a list was a second one.

Existing versions are migrated: each gets a plan with a single `form: human` node named for its
skill. Nothing guesses at a flow it cannot read. `POST …/skills` now creates a **draft** rather than
publishing v1, and `GET …/skills` carries `is_draft`, `draft_version_id` and a plan summary.
