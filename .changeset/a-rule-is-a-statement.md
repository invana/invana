---
"invana": minor
---

A rule is a statement (skills-pass.md K4 · RU1–RU7).

The other half of what a run is **given** before it runs. A skill is a playbook that may be
offered; a rule is a statement that is always true in its scope. Neither is enforced — a rule
that must be enforced is an envelope bound or a criterion, not a rule.

`rules` and `rule_versions` are new, and so is everything around them:

```
GET  POST   …/rules                       a Graph's invariants
GET  POST   …/projects/{key}/rules        a Project's working rules, with what it inherits
GET  PATCH  …/rules/{rule_id}             one rule, either scope
POST        …/rules/{rule_id}/activate
POST        …/rules/{rule_id}/deactivate
GET         …/rules/{rule_id}/versions    what a citation resolves to
```

**One axis.** A rule always belongs to a Graph, and a `project_id` is what makes it a working
rule rather than an invariant — so `scope` and `kind` are read off that one column instead of
stored beside it. Both words stay in the API and on the surface; neither can disagree with the
other, and `scope='graph', kind='working'` is not representable.

**Deactivating is not deleting, and not a version.** `active` lives on the rule, so turning one
off stops it being offered and leaves every version, and every step that cited one, exactly
where it was. There is no delete route.

At run time the rules in scope reach the prompt in a fixed order — the Graph's invariants, then
the Project's working rules — **each as its own numbered line, never concatenated**, so the
model can cite the one it followed. A session ask belongs to no Project and is offered the
invariants alone. Rewording a rule publishes the next version, and a step that cited the old
wording still shows the old wording in its trace.

`task_runs` gains `rules_offered` and `rules_cited`, the same two certainties skills already
record: the first is a fact written by assembly, the second is the model's own claim, cited by
statement because that is what it was shown. Anything it cites that it was not offered is
dropped. Without the first column, *never cited* could not be told from *never offered*, which
is the whole point of looking.
