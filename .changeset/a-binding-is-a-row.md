---
"invana": minor
---

A binding is a row (skills-pass.md K3 · BN2 · BN6).

`agents.skill_ids` was a JSON array: the whole roster replaced on every agent save. A bind that
must name **which** skill it rejected, and why, has nothing to hold on to when the request is a
list — and nothing records who changed the roster, or when.

`skill_bindings` is that row — `skill_id · agent_id · bound_by_id · bound_at` — and it belongs
to **Skills**, not to Agents: Skills is an independent module that agents bind to, so the table
is named for what it binds rather than for the pair. Nothing in `apps/skills` imports an agent
to write one.

```
POST   …/agents/{id}/skills/{skill_id}   offer it
DELETE …/agents/{id}/skills/{skill_id}   take it back
```

Both return the agent, and both emit an event — `agent.skill_bound` · `agent.skill_unbound` —
so the roster has a history. Binding what is already bound is a `409`, not a silent no-op: the
caller believes it is changing something, and it is not. Unbinding what was never bound reads
as absent. A binding still points at the **skill**, never at a version, so publishing a better
version reaches every agent that carries it.

`skill_ids` is now read-only on an agent: `AgentRead` still carries it — the roster badge and
the picker both need it — and `AgentUpdate` no longer accepts it. `AgentCreate` still does,
because the roster an agent starts with is part of creating it, and those bind through the same
manager. In Studio, the skills picker on the agent panel binds and unbinds as you click rather
than staging into `Save`: a bind can be refused on its own, and a refusal that arrived alongside
six other edits could not say which one it was about.

Existing arrays are migrated to rows. `bound_by_id` is **NULL** and `bound_at` is the agent's
`created_at` — nobody recorded who bound these, and the honest answer to *who* is nothing. An id
naming a skill that no longer exists, or one in another Graph, is dropped: unlike a dangling id
in a step's record, which is a record of what happened, a binding is a statement about what
happens next, and a binding to nothing has nothing to offer.

**The bind-time check is not in this release.** [BN5](docs/for-developers/modules/skills/features/bindings.md)
wants a bind refused when the skill's plan names a step the agent may not call, or needs a
participant its lens denies. Neither half can run yet: a skill has no plan until skill versions
draw one, and an agent has no lens until lenses exist. The write path this ships is what those
checks will hang off — and until then a bind is never refused on grounds it did not check.
