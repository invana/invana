---
"invana": minor
---

Govern — a world and a guardrail are one row, and a rule is an address plus allow or deny
(GV1 · GV4 · GV5 · GV23 · WO1 · GR2 · GR5).

**The lens exists.** `task_runs` has carried `lens_id` and `lens_snapshot` since the task-model
migration and nothing ever wrote to them, because there was no table to point at. There is now:
`lenses`, one row for both a *world* people pick per question and a *guardrail* always in force,
separated by `kind` and nothing else. One enforcement path, one document frozen onto a run, and
promotion is a field change rather than a re-authoring.

**One grammar over five layers.** A rule matches `<layer>/<sublayer>/<name>` — `*` for one segment,
`**` for the rest — and allows or denies it. `allow` is the only required field; excluded
properties, a `time`/`geo`/`dims` slice and `egress.may_send` hang off that one decision. A third
party carries no selector, and a rule that sets one is refused naming the layer.

**Three laws, enforced in one place.** Deny wins at any specificity, so a broad `third_party/** deny`
is not punchable by a narrow allow written later. Allow intersects, deny accumulates and selectors
intersect across agent, plan and Todo. The default is the widest — a Graph that sets no lens sees
everything it is configured for.

**The ladder, each rung one edit.** A lens starts unnamed, attached to its run and in nobody's list.
Typing a name publishes it to Worlds; changing `kind` promotes it to a guardrail. A rename after
that is just a rename — the slug is frozen at the first naming, so a schedule that pinned one keeps
resolving.

**Refusals name their bound.** A world that would widen a guardrail is refused at *save*, naming the
guardrail's rule. A slice along an axis the model never declared is refused naming the model and the
axis. A cast the rules deny is refused before the run opens, naming the role, the model and the rule.

```
POST …/govern/lenses                  a world, or a guardrail
PATCH …/govern/lenses/{id}            naming it is the write that publishes
POST …/govern/lenses/{id}/promote     world → guardrail. One field
POST …/govern/lenses/validate         what a save would be refused for
POST …/govern/lenses/impact           "Saving this would change 2 of 4 worlds"
GET  …/govern/participants            the catalogue, and what a rule matches now
GET  …/govern/runs/{id}/touches       allowed · touched · never touched · refused
GET  …/govern/compare?a=&b=           two runs, side by side
```

**What a run touched.** `run_touches` is the indexed projection of `task_stream` — one row per
engagement, carrying the ledger's own `seq`, with the address, the direction, `rows` *and*
`rows_available`, what was sent, and both the generated and executed query digests. The stream stays
authoritative and the table is rebuildable from it.

Also: `agents.lens_id` is the third bound beside the envelope and the budget;
`graph_members.can_edit_guardrails` is the one field-level permission, held by the Graph's owner
after the backfill, and every member still reads every rule; `graph_versions.axes` is what makes a
slice legal; `graphs.pools` names the `llm`, `graphdb` and `heavy` ceilings a run draws on.

Nothing is dropped and nothing existing changes meaning: a Graph that never opens the Govern panel
behaves exactly as it did.
