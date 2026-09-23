---
"invana": minor
---

A bind is refused on what it checked, and a drawn plan can be corrected by hand
(BN5 · BN7 · BN9 · SK7 · SK28).

**The envelope half of a bind.** Binding a skill an agent could never run used to succeed, and the
failure arrived inside a run. It now fails where somebody can read it: the bind reads the plan the
skill's current version draws, and any `step_key` outside the agent's envelope refuses with a `409`
that names what it found.

```
409 skill_binding_refused
  check              "envelope"
  skill_version_id   the version it read
  step_key           "translate_thought"
  bound              "llm"
  checked            ["envelope"]
  not_checked        ["lens"]
```

`checked` and `not_checked` are the point: the **lens** half — refusing a skill whose plan needs a
participant the agent's guardrails deny — still waits on the lens migration, and a bind is never
refused on grounds it did not check. Three cases pass because there is nothing to read: a skill with
no published version, an agent with no envelope, and a step a person does. A **spawn** is not checked
either — a child's bindings is named by its parent inside a run, so refusing there would manufacture the
3am failure this exists to prevent; the child's narrower envelope still refuses the call at dispatch.

**The hand-edit.** `PATCH …/skills/{id}/draft/tasks` replaces the draft's plan rows and flips
`task_plans.origin` to `authored`, after which redrawing from the prose is offered rather than
automatic. It is for the case the prose cannot fix: the reading is wrong but the sentence is right, or
the planner named a dead end. Row-level, not a flow editor — a person says which step, what it is
called and what it takes, and the edges are materialised from the `${steps.X.y}` bindings and the
catalogue's `requires`, so an order nobody reviewed is never written down.

What bounds it is the **catalogue**, not an agent's envelope: a skill belongs to no agent, so *may
this agent call this step* is checked where the agent is known — at bind time. A step the catalogue
does not declare is refused by name, a step a person does is always allowed, and a plan with no steps
at all is refused as what it is: a rule, not a skill.
